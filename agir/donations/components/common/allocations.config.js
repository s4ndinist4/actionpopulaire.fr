export const TYPE_CNS = "cns";
export const TYPE_GROUP = "group";
export const TYPE_DEPARTMENT = "departement";
export const TYPE_NATIONAL = "national";

export const TYPE_LABEL = {
  [TYPE_CNS]: "à la caisse nationale de solidarité",
  [TYPE_NATIONAL]:
    "aux actions et campagnes nationales, ainsi qu'aux outils mis à la disposition des insoumis⋅es (comme Action populaire !)",
  [TYPE_GROUP]: "au groupe d'action",
  [TYPE_DEPARTMENT]:
    "aux activités de votre département (ou circonscription législative pour les français·es de l'étranger)",
};

export const splitAllocationPerRenewable = (data) => {
  let renewableAllocations = [];
  let nonRenewableGroupAllocation = null;

  if (!data || !Array.isArray(data.allocations)) {
    return [renewableAllocations, nonRenewableGroupAllocation];
  }

  data.allocations.forEach((allocation) => {
    if (
      !allocation.group ||
      (allocation.group.isPublished && allocation.group.isCertified)
    ) {
      renewableAllocations.push(allocation);
      return;
    }
    nonRenewableGroupAllocation = allocation;
  });

  return [renewableAllocations, nonRenewableGroupAllocation];
};

export const flatAllocations = (allocations) => {
  return allocations.map((allocation) => {
    if (allocation.departement) {
      return {
        ...allocation,
        departement: allocation.departement.id,
        type: "departement",
      };
    } else if (allocation.group) {
      return {
        ...allocation,
        group: allocation.group.id,
        type: "group",
      };
    }
    return allocation;
  });
};

export const getRemainingAmount = (value, totalAmount) => {
  if (!value) {
    return 0;
  }
  value = Array.isArray(value) ? value : Object.values(value);
  const sum = value.reduce(
    (tot, allocation) =>
      isNaN(parseInt(allocation.amount ?? allocation.value))
        ? tot
        : tot + (allocation.amount ?? allocation.value),
    0,
  );
  return totalAmount - sum;
};

export const distributeInteger = (total, divider) => {
  total = total / 100;
  let result = [];
  let remainder = total;
  for (let i = 0; i < divider; i++) {
    result[i] =
      total > 1
        ? Math.floor(total / divider) + Number(i < total % divider)
        : total / divider;
    remainder = remainder - result[i];
  }
  result[result.length - 1] += remainder;

  return result.map((item) => Math.round(item * 100));
};

export const getDefaultAllocations = (totalAmount, options) => {
  let result = {};
  options
    .filter((option) => !!option.fixedRatio)
    .forEach((option) => {
      result[option.type] = Math.round(totalAmount * option.fixedRatio);
      totalAmount -= result[option.type];
    });

  if (totalAmount === 0) {
    return result;
  }

  const remainingTargets = options.filter((option) => !option.fixedRatio);

  remainingTargets.forEach(
    (option, i) => (result[option.type] = i === 0 ? totalAmount : 0),
  );

  return result;
};

export const getAllocationOptions = (
  totalAmount = 0,
  groupId = null,
  fixedRatio = 0,
) => {
  const options = [
    fixedRatio
      ? {
          type: TYPE_CNS,
          label: TYPE_LABEL[TYPE_CNS],
          fixedRatio,
          defaultValue: 0,
        }
      : undefined,
    {
      type: TYPE_NATIONAL,
      label: TYPE_LABEL[TYPE_NATIONAL],
      defaultValue: 0,
    },
    {
      type: TYPE_DEPARTMENT,
      label: TYPE_LABEL[TYPE_DEPARTMENT],
      defaultValue: 0,
    },
    groupId
      ? {
          type: TYPE_GROUP,
          label: TYPE_LABEL[TYPE_GROUP],
          group: groupId,
          defaultValue: 0,
        }
      : undefined,
  ].filter(Boolean);

  if (!totalAmount) {
    return options;
  }

  const defaults = getDefaultAllocations(totalAmount, options);

  return options.map((option) => ({
    ...option,
    defaultValue: defaults[option.type] || option.defaultValue,
  }));
};

export const getAllocationGroup = (allocations) => {
  if (!Array.isArray(allocations)) {
    return null;
  }

  const allocation = allocations.find(
    (allocation) => allocation.type === TYPE_GROUP,
  );

  if (!allocation || !allocation.group) {
    return null;
  }

  return allocation.group;
};

export const getAllocationDepartement = (allocations) => {
  if (!Array.isArray(allocations)) {
    return null;
  }

  const allocation = allocations.find(
    (allocation) => allocation.type === TYPE_DEPARTMENT,
  );

  if (!allocation || !allocation.departement) {
    return null;
  }

  return allocation.departement;
};
