import validate from "@agir/lib/utils/validate";
import { getAllocationDepartement } from "./allocations.config";

export const SINGLE_TIME_PAYMENT = "S";
export const MONTHLY_PAYMENT = "M";

export const GENDER_OPTIONS = [
  { label: "", value: "" },
  { label: "Madame", value: "F" },
  { label: "Monsieur", value: "M" },
];

export const INITIAL_DATA = {
  email: "",
  firstName: "",
  lastName: "",
  contactPhone: "",
  gender: "",
  locationAddress1: "",
  locationAddress2: "",
  locationCity: "",
  locationCountry: "FR",
  nationality: "FR",
  frenchResident: true,
  departement: "",

  paymentType: "",
  paymentMode: "",
  amount: 0,
  paymentTiming: "",
  allocations: [],
  consentCertification: false,
};

export const setFormDataForUser = (user) => (data) => ({
  ...data,
  email: data.email || user.email || INITIAL_DATA.email,
  firstName: data.firstName || user.firstName || INITIAL_DATA.firstName,
  lastName: data.lastName || user.lastName || INITIAL_DATA.lastName,
  contactPhone:
    data.contactPhone || user.contactPhone || INITIAL_DATA.contactPhone,
  locationAddress1:
    data.locationAddress1 || user.address1 || INITIAL_DATA.locationAddress1,
  locationAddress2:
    data.locationAddress2 || user.address2 || INITIAL_DATA.locationAddress2,
  locationZip: data.locationZip || user.zip || INITIAL_DATA.locationZip,
  locationCity: data.locationCity || user.city || INITIAL_DATA.locationCity,
  locationCountry: data.locationCountry || user.country || INITIAL_DATA.country,
  departement: data.departement || user.departement || INITIAL_DATA.departement,
  gender: data.gender
    ? data.gender
    : GENDER_OPTIONS.includes(user.gender)
      ? user.gender
      : INITIAL_DATA.gender,
});

export const setFormDataFromExistingDonation = (existingDonation) => (data) => {
  if (!existingDonation) {
    return data;
  }
  const newData = { ...data };

  Object.entries(existingDonation).forEach(([key, value]) => {
    switch (key) {
      case "id":
      case "created":
      case "renewable":
      case "allocations":
        return;
      case "endDate":
        newData.effectDate = value;
        break;
      default:
        newData[key] = value || data[value] || INITIAL_DATA[value];
    }
  });

  const departement = getAllocationDepartement(existingDonation.allocations);
  if (departement) {
    newData["departement"] = departement.id;
  }

  return newData;
};

export const DONATION_DATA_CONSTRAINTS = (config) => ({
  email: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
    email: {
      message: "Saisissez une adresse e-mail valide.",
    },
  },
  firstName: {
    presence: {
      allowEmpty: false,
      message: "Ce champ est obligatoire",
    },
    length: {
      maximum: 255,
      tooLong:
        "La valeur de ce champ ne peut pas dépasser les %{count} caractères",
    },
  },
  lastName: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
    length: {
      maximum: 255,
      tooLong:
        "La valeur de ce champ ne peut pas dépasser les %{count} caractères",
    },
  },
  dateOfBirth: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
    dateOfBirth: {
      message:
        "Vous devez être une personne majeure pour pouvoir faire un don.",
    },
  },
  contactPhone: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
    phone: {
      message: "Saisissez un numéro de téléphone valide.",
    },
  },
  gender: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
    inclusion: {
      within: GENDER_OPTIONS.map((option) => option.value).filter(Boolean),
      message: "Veuillez choisir une des options.",
    },
  },
  locationAddress1: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
  },
  locationCity: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
  },
  locationCountry: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
  },
  nationality: {
    presence: {
      allowEmpty: false,
      message:
        "Votre nationalité fait partie des informations que nous devons déclarer aux autorités de régulation.",
    },
  },
  paymentMode: {
    presence: {
      allowEmpty: false,
      message: "Indiquez le mode de paiement à utiliser",
    },
  },
  amount: {
    presence: {
      allowEmpty: false,
      message: "Choisissez le montant de votre don.",
    },
    numericality: {
      onlyInteger: true,
      greaterThan: 0,
      lessThan: (config?.maxAmount ?? 0) + 1,
      message: "Merci de sélectionner un montant entre 1 et 7500 €.",
    },
  },
  paymentTiming: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
  },
  honorCertified: {
    presence: {
      allowEmpty: false,
      message:
        "Nous devons impérativement recueillir votre engagement que ce don ne provient pas d'une personne morale.",
    },
    bool: {
      message:
        "Nous devons impérativement recueillir votre engagement que ce don ne provient pas d'une personne morale.",
    },
  },
});

const NEW_DONATION_DATA_CONSTRAINTS = (config) => ({
  ...DONATION_DATA_CONSTRAINTS(config),
  departement: {
    presence: {
      allowEmpty: false,
      message: "Ce champ ne peut pas être vide.",
    },
  },
  frenchResident: {
    inclusion: {
      within: [true],
      message:
        "Si vous n'avez pas la nationalité française, vous devez être résident fiscalement en France pour faire une donation",
    },
  },
  consentCertification: {
    inclusion: {
      within: [true],
      message: "Vous devez cocher la case précédente pour continuer",
    },
  },
});

export const validateDonationData = (data, config) =>
  validate(data, NEW_DONATION_DATA_CONSTRAINTS(config), {
    format: "cleanMessage",
    fullMessages: false,
  });

export const validateContributionRenewal = (data, config) =>
  validate(
    data,
    {
      ...DONATION_DATA_CONSTRAINTS(config),
      honorCertified: {},
    },
    {
      format: "cleanMessage",
      fullMessages: false,
    },
  );
