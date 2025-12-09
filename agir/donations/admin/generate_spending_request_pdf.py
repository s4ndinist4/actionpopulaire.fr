import requests
from django.conf import settings
import mimetypes

from fpdf.enums import WrapMode, XPos
from storages.backends.s3 import S3File

from agir.donations.models import SpendingRequest
from fpdf import FPDF
from PIL import Image
from pypdf import PdfReader, PdfWriter
import io
from django.template.defaultfilters import floatformat

A4_RATIO = 210 / 297
PX_MM_RATIO = 0.264583


class SpendingRequestGenerationPdf:
    spending_request: SpendingRequest
    # contains text and images
    pdf: FPDF
    # contains other pdf
    pdf_writer: PdfWriter

    def __init__(self, spending_request):
        self.spending_request = spending_request
        self.pdf = FPDF()
        self.pdf_writer = PdfWriter()

    def gen_intro_page(self):
        # header
        self.pdf.add_page()
        self.pdf.add_font(
            family="DejaVuSansCondensed",
            fname="/usr/share/fonts/DejaVuSansCondensed.ttf",
            uni=True,
        )
        self.pdf.set_font("DejaVuSansCondensed", size=14)

        self.pdf.cell(40)
        self.pdf.cell(120, 10, self.spending_request.title, 1, 0, "C")
        self.pdf.ln(20)
        self.append_text(
            f"Type de dépense : {SpendingRequest.Timing(self.spending_request.timing).label}"
        )
        self.append_text(f"Date d'achat : {self.spending_request.spending_date}")
        self.append_text(
            f"Montant : {floatformat(self.spending_request.amount/100, 2)} €"
        )
        if self.spending_request.creator:
            self.append_text(
                f"Demande réalisée par : {self.spending_request.creator.get_full_name()}"
            )
            self.append_text(f"Email : {self.spending_request.creator.email}")
            self.append_text(
                f"Numéro de téléphone : {self.spending_request.creator.contact_phone}"
            )
        self.append_text(
            f"Bénéficiaire : {self.spending_request.bank_account_first_name} {self.spending_request.bank_account_last_name}"
        )
        self.append_text(
            f"Catégorie : {SpendingRequest.Category(self.spending_request.category).label}"
        )
        self.append_text(f"Motif d'achat : {self.spending_request.explanation}")
        self.append_text(
            f"Groupe lié à la dépense : {self.spending_request.get_group_full_name()}"
        )
        self.append_text(
            f"Dans cadre d'une campagne éléctorale : {'Oui' if self.spending_request.campaign else 'Non'}"
        )
        self.pdf.ln(10)
        self.pdf.line(
            self.pdf.get_x(), self.pdf.get_y(), self.pdf.get_x() + 150, self.pdf.get_y()
        )
        self.pdf.ln(10)
        self.append_text(f"IBAN : {self.spending_request.bank_account_iban}")
        self.append_text(f"BIC : {self.spending_request.bank_account_bic}")

        self.append_to_writer()
        self.append_rib()

    def append_rib(self):
        self.add(self.spending_request.bank_account_rib)

    def add(self, field):
        try:
            if "application/pdf" in mimetypes.guess_type(field.file.name):
                self.add_pdf(field.url)
            else:
                self.add_image(field)
        except ValueError as e:
            # bank_account_rib is empty
            pass

    def append_text(self, text):
        self.pdf.multi_cell(
            w=0, h=None, text=text, align="L", wrapmode=WrapMode.CHAR, new_x=XPos.LEFT
        )
        self.pdf.ln()

    def get_file_name(self):
        return self.spending_request.get_download_file_name()

    def normalize_url(self, url):
        if not url.startswith("https"):
            return settings.FRONT_DOMAIN + url
        return url

    def get_url_from(self, field):
        return field.url if hasattr(field, "url") else field.file.url

    def add_image(self, image):
        Image.MAX_IMAGE_PIXELS = 258645000
        img = Image.open(image.file)
        img.verify()

        self.pdf.add_page()
        page_length = len(self.pdf.pages)
        page_dimensions = self.pdf.pages.get(page_length).dimensions()
        width = img.size[0]
        height = img.size[1]
        image_ratio = height / width
        url = self.get_url_from(image)

        if image_ratio > 1:
            if height > page_dimensions[1]:
                height = int(page_dimensions[1] * PX_MM_RATIO)
                width = height / image_ratio
            else:
                height = int(height * PX_MM_RATIO)
                width = height / image_ratio
        else:
            if width > page_dimensions[0]:
                width = int(page_dimensions[0] * PX_MM_RATIO)
                height = int(width * image_ratio)
            else:
                width = int(width * PX_MM_RATIO)
                height = int(width * image_ratio)

        self.pdf.image(self.normalize_url(url), w=width, h=height)

    def append_to_writer(self):
        pdf_buffer = io.BytesIO()
        self.pdf.output(pdf_buffer, "F")
        pdf_buffer.seek(0)
        pdf_reader = PdfReader(pdf_buffer)
        for page in pdf_reader.pages:
            self.pdf_writer.add_page(page)
        self.pdf = FPDF()

    def add_pdf(self, pdf_url):
        response = requests.get(self.normalize_url(pdf_url))
        response.raise_for_status()  # Optionnel : lève une erreur si le téléchargement échoue

        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)

        for page in reader.pages:
            self.pdf_writer.add_page(page)

    def print_documents(self):
        all_documents = self.spending_request.documents.filter(deleted=False)
        pdf_list = [
            doc.file.url
            for doc in all_documents
            if "application/pdf" in mimetypes.guess_type(doc.file.name)
        ]
        image_list = [
            doc
            for doc in all_documents
            if "application/pdf" not in mimetypes.guess_type(doc.file.name)
        ]
        [self.add_image(image) for image in image_list]
        self.append_to_writer()
        [self.add_pdf(pdf) for pdf in pdf_list]

    def generate(self):
        self.gen_intro_page()
        self.print_documents()
        return self.pdf_writer
