import React from "react"
import CreditCard from "@agir/front/genericComponents/donation/CreditCard";
import PenField from "@agir/front/genericComponents/donation/PenField";
import Button from "@agir/front/genericComponents/Button";
import styled from "styled-components";
import {RawFeatherIcon} from "@agir/front/genericComponents/FeatherIcon";
import acceptedPaymentMethods from "@agir/donations/common/images/accepted-payment-methods.svg";
import {useDonationContext} from "@agir/donations/DonationContext";
import {FormContainer, PaymentError} from "@agir/donations/Common.style";
import CONFIG from "@agir/donations/common/config";
import {DONNER_BUTTON_ID} from "@agir/donations/form/DonationValidation";
import {scrollToElement} from "@agir/front/app/utils";

const WithinButton = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 10rem;
    height: 10rem;
    gap: 10px;

`

const PaymentButtons = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: 15px;
    
    button {
        padding: 0.7rem;
    }
`

const PaymentParagraph = styled.p`
  padding: 1rem 0;
  max-width: 582px;
  margin: 0 auto;
  text-align: center;
  font-weight: 600;
  font-size: 0.8rem;
  color: ${(props) => props.theme.text500};

  & > span {
    display: flex;
    justify-content: center;
    align-items: center;
    padding-bottom: 0.7rem;
  }
`;

const PAYMENT_MODE = {
    CHECK: "check_donations",
    SYSTEM_PAY: "system_pay"
}

export default function DonationPayment() {
    const {update, paymentMode, errors} = useDonationContext()
    const { to, paymentTiming } = useDonationContext()
    const config =  CONFIG[to] ?? CONFIG.default;
    const currentPaymentModes = config.allowedPaymentModes[paymentTiming];
    const systemPayMode = currentPaymentModes.find((val) => val.includes("system"))
    const checkMode = currentPaymentModes.find((val) => val.includes("check"))

  function selectPaymentMode(mode) {
    scrollToElement(document.getElementById(DONNER_BUTTON_ID), window, window.screen.height / 2 + 20);
    update({paymentMode: mode})
  }

    return <FormContainer>
        <h3>Type de paiement</h3>
        <PaymentButtons name="paymentMode">
            {systemPayMode &&
                <Button
                    active={paymentMode === systemPayMode}
                    onClick={() => selectPaymentMode(systemPayMode)}
                    color="lfi">
                    <WithinButton>
                        <CreditCard width="5rem"/>
                        <p>Payer par carte<br/>bancaire</p>
                    </WithinButton>
                </Button>
            }
            {checkMode &&
                <Button active={paymentMode === checkMode}
                        onClick={() => selectPaymentMode(checkMode)}
                        color="lfi">
                    <WithinButton>
                        <PenField width="5rem"/>
                        <p>Payer par chèque</p>
                    </WithinButton>
                </Button>
            }
        </PaymentButtons>
        <div>
            <PaymentParagraph>
                <span><RawFeatherIcon width="1rem" height="1rem" name="lock"/>&ensp;SÉCURISÉ ET ANONYME</span>
                <img
                    width="366"
                    height="26"
                    src={acceptedPaymentMethods}
                    alt="Moyens de paiement acceptés : Visa, Visa Electron, Mastercard, Maestro, Carte Bleue, E-Carte Bleue"
                />
            </PaymentParagraph>
            {errors?.paymentMode && <PaymentError>{ errors.paymentMode }</PaymentError>}
        </div>
    </FormContainer>
}