from datetime import timezone, datetime
import json

import reversion
from django.db import transaction
from django.http import Http404
from django.urls import reverse
from django.utils import timezone
from nested_multipart_parser.drf import DrfNestedParser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import (
    GenericAPIView,
    RetrieveUpdateDestroyAPIView,
    CreateAPIView,
    RetrieveAPIView,
)
from rest_framework.mixins import UpdateModelMixin
from rest_framework.parsers import JSONParser
from rest_framework.response import Response

from agir.api import settings
from agir.donations.actions import (
    existing_monthly_payment,
)
from agir.donations.apps import DonsConfig
from agir.donations.models import SpendingRequest, Document
from agir.donations.serializers import (
    DonationSerializer,
    SpendingRequestSerializer,
    SpendingRequestDocumentSerializer,
    ContributionSerializer,
)
from agir.donations.spending_requests import (
    validate_action,
    get_missing_field_error_message,
)
from agir.donations.tasks import send_monthly_donation_confirmation_email
from agir.donations.views import DONATION_SESSION_NAMESPACE
from agir.lib.rest_framework_permissions import (
    IsActionPopulaireClientPermission,
    GlobalOrObjectPermissions,
    IsPersonPermission,
)
from agir.payments.actions.payments import create_payment
from agir.payments.actions.subscriptions import (
    create_subscription,
)
from agir.payments.models import Subscription

from urllib.parse import urlparse
from urllib.parse import parse_qs

class CreateDonationAPIView(UpdateModelMixin, GenericAPIView):
    permission_classes = (IsActionPopulaireClientPermission,)
    serializer_class = DonationSerializer

    def get_object(self):
        if self.request.user.is_authenticated:
            return self.request.user.person

    def clear_session(self):
        if DONATION_SESSION_NAMESPACE in self.request.session:
            del self.request.session[DONATION_SESSION_NAMESPACE]

    def get_existing_subscription(self, **kwargs):
        return existing_monthly_payment(self.person)

    def make_subscription(self):
        validated_data = self.validated_data
        payment_type = validated_data.get("payment_type")
        payment_mode = validated_data.get("payment_mode")
        amount = validated_data.get("amount")
        allocations = validated_data.get("allocations", [])

        # aujourd'hui selon la zone Europe/Paris
        today = timezone.now().astimezone(timezone.get_default_timezone()).date()
        effect_date = today + timezone.timedelta(days=1)

        # Confirm email if the user is unknown
        if self.person is None:
            if not "allocations" in validated_data:
                validated_data["allocations"] = "[]"

            send_monthly_donation_confirmation_email.delay(
                data=validated_data,
            )
            self.clear_session()

            return Response(
                {"next": reverse("monthly_donation_confirmation_email_sent")}
            )

        existing_subscription = self.get_existing_subscription()
        # Redirect to a specific page if the existing subscription is not a contribution
        if existing_subscription:
            # stocker toutes les infos en session
            # attention à ne pas juste modifier le dictionnaire existant,
            # parce que la session ne se "rendrait pas compte" qu'elle a changé
            # et cela ne serait donc pas persisté
            if validated_data["date_of_birth"] is not None:
                validated_data["date_of_birth"] = validated_data[
                    "date_of_birth"
                ].isoformat()

            self.request.session[DONATION_SESSION_NAMESPACE] = {
                **self.request.session.get(DONATION_SESSION_NAMESPACE, {}),
                "new_subscription": {
                    "from_type": existing_subscription.type,
                    "type": payment_type,
                    "mode": payment_mode,
                    "amount": amount,
                    "meta": {
                        **validated_data,
                        **self.get_utm_infos(),
                    },
                },
            }

            return Response({"next": reverse("already_has_subscription")})

        with transaction.atomic():
            subscription = create_subscription(
                person=self.person,
                type=payment_type,
                mode=payment_mode,
                amount=amount,
                allocations=allocations,
                meta={**validated_data, **self.get_utm_infos()},
                effect_date=effect_date,
            )

            self.clear_session()

        return Response({"next": reverse("subscription_page", args=[subscription.pk])})

    @staticmethod
    def get_utm_value(query, key):
        value = query.get(key, None)
        if value is not None:
            return value[0]
        return value

    def get_utm_infos(self):
        referer = self.request.META.get("HTTP_REFERER")
        parsed_url = urlparse(referer)
        query = parse_qs(parsed_url.query)
        return {
            "utm_source": self.get_utm_value(query, "utm_source"),
            "utm_medium": self.get_utm_value(query, "utm_medium"),
            "utm_campaign": self.get_utm_value(query, "utm_campaign"),
        }

    def make_payment(self):
        payment_type = self.validated_data.get("payment_type")
        payment_mode = self.validated_data.get("payment_mode")
        amount = self.validated_data.get("amount")

        meta = {**self.validated_data, **self.get_utm_infos()}

        with transaction.atomic():
            payment = create_payment(
                person=self.person,
                type=payment_type,
                mode=payment_mode,
                price=amount,
                meta=meta,
                **self.kwargs,
            )

        self.clear_session()
        return Response({"next": payment.get_payment_url()})

    def post(self, request, *args, **kwargs):
        self.person = self.get_object()
        serializer = self.get_serializer(self.person, data=request.data)
        serializer.is_valid(raise_exception=True)
        self.validated_data = serializer.validated_data

        # User exist and connected : update user informations
        if self.person is not None:
            self.perform_update(serializer)

        if "allocations" in self.validated_data:
            self.validated_data["allocations"] = json.dumps(
                self.validated_data["allocations"]
            )

        if self.validated_data["payment_type"] == DonsConfig.MONTHLY_DONATION_TYPE:
            return self.make_subscription()

        return self.make_payment()


class ActiveSubscriptionRetrievePermissions(GlobalOrObjectPermissions):
    perms_map = {"GET": []}
    object_perms_map = {"GET": ["donations.view_active_contribution"]}


class ActiveSubscriptionRetrieveAPIView(RetrieveAPIView):
    serializer_class = ContributionSerializer
    queryset = Subscription.objects.contributions().active()
    permission_classes = (
        IsPersonPermission,
        ActiveSubscriptionRetrievePermissions,
    )

    def get_object(self):
        person = self.request.user.person
        obj = existing_monthly_payment(person)

        if obj is None:
            raise Http404

        self.check_object_permissions(self.request, obj)

        return obj


class SpendingRequestCreatePermissions(GlobalOrObjectPermissions):
    perms_map = {
        "OPTIONS": [],
        "POST": [],
    }
    object_perms_map = {
        "OPTIONS": [],
        "POST": ["donations.view_spendingrequest"],
    }


class SpendingRequestCreateAPIView(CreateAPIView):
    parser_classes = (JSONParser, DrfNestedParser)
    permission_classes = (
        IsPersonPermission,
        SpendingRequestCreatePermissions,
    )
    serializer_class = SpendingRequestSerializer
    queryset = SpendingRequest.objects.all()

    def check_object_group_permission(self, group):
        if not self.request.user.has_perm("donations.add_spendingrequest", group):
            self.permission_denied(
                self.request,
                message="Vous ne pouvez pas créer de demande pour ce groupe",
            )

    def perform_create(self, serializer):
        self.check_object_group_permission(serializer.validated_data.get("group", None))
        super().perform_create(serializer)


class SpendingRequestRetrieveUpdateDestroyPermissions(GlobalOrObjectPermissions):
    message = (
        "Vous n'avez pas la permission d'effectuer cette action."
        "Veuillez contacter nos équipes à groupes@actionpopulaire.fr"
    )

    perms_map = {
        "OPTIONS": [],
        "GET": [],
        "PUT": [],
        "PATCH": [],
        "DELETE": [],
    }
    object_perms_map = {
        "OPTIONS": [],
        "GET": ["donations.view_spendingrequest"],
        "PUT": ["donations.change_spendingrequest"],
        "PATCH": ["donations.change_spendingrequest"],
        "DELETE": ["donations.delete_spendingrequest"],
    }


class SpendingRequestRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    parser_classes = (JSONParser, DrfNestedParser)
    permission_classes = (
        IsPersonPermission,
        SpendingRequestRetrieveUpdateDestroyPermissions,
    )
    serializer_class = SpendingRequestSerializer
    queryset = SpendingRequest.objects.with_serializer_prefetch()


class SpendingRequestDocumentCreatePermissions(
    SpendingRequestRetrieveUpdateDestroyPermissions
):
    perms_map = {
        "OPTIONS": [],
        "POST": [],
    }
    object_perms_map = {
        "OPTIONS": [],
        "POST": ["donations.add_document_to_spending_request"],
    }


class SpendingRequestDocumentCreateAPIView(CreateAPIView):
    permission_classes = (
        IsPersonPermission,
        SpendingRequestDocumentCreatePermissions,
    )
    serializer_class = SpendingRequestDocumentSerializer
    queryset = SpendingRequest.objects.all()

    def create(self, request, *args, **kwargs):
        self.spending_request = self.get_object()
        return super().create(request, *args, **kwargs)

    def get_serializer(self, *args, data, **kwargs):
        data["request"] = self.spending_request.pk
        return super().get_serializer(*args, data=data, **kwargs)


class SpendingRequestDocumentRetrieveUpdateDestroyPermissions(
    SpendingRequestRetrieveUpdateDestroyPermissions
):
    object_perms_map = {
        "OPTIONS": [],
        "GET": ["donations.view_spendingrequest"],
        "PUT": ["donations.change_spendingrequest"],
        "PATCH": ["donations.change_spendingrequest"],
        "DELETE": ["donations.change_spendingrequest"],
    }


class SpendingRequestDocumentRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    permission_classes = (
        IsPersonPermission,
        SpendingRequestDocumentRetrieveUpdateDestroyPermissions,
    )
    serializer_class = SpendingRequestDocumentSerializer
    queryset = Document.objects.filter(deleted=False)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj.request)

    def perform_destroy(self, instance):
        with reversion.create_revision():
            reversion.set_user(self.request.user)
            reversion.set_comment(f"Suppression d'une pièce-jointe : {instance.title}")
            reversion.add_to_revision(instance.request)
            instance.deleted = True
            instance.save()


class SpendingRequestApplyNextStatusPermissions(GlobalOrObjectPermissions):
    perms_map = {
        "OPTIONS": [],
        "GET": [],
    }
    object_perms_map = {"OPTIONS": [], "GET": ["donations.change_spendingrequest"]}


class SpendingRequestApplyNextStatusAPIView(RetrieveAPIView):
    permission_classes = (
        IsPersonPermission,
        SpendingRequestApplyNextStatusPermissions,
    )
    serializer_class = SpendingRequestSerializer
    queryset = SpendingRequest.objects.with_serializer_prefetch()

    def get_object(self):
        spending_request = super().get_object()
        is_valid = validate_action(spending_request, self.request.user)

        if is_valid:
            return spending_request

        message = (
            get_missing_field_error_message(spending_request)
            or "L'opération n'est pas autorisée pour cette demande de dépense"
        )

        self.permission_denied(
            self.request,
            message=message,
        )


def get_election_in_progress():
    elections = []
    for election in settings.SPENDING_REQUEST_ELECTIONS:
        current = settings.SPENDING_REQUEST_ELECTIONS[election]
        if current["start"] < datetime.now() < current["end"]:
            elections.append(election)
    return elections


@api_view(["GET"])
@permission_classes((IsPersonPermission,))
def get_current_election_spending_request_view(request):
    return Response(get_election_in_progress())
