export function createThemedStyles(colors: any) {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        const key = String(prop).toLowerCase();
        const style: any = {};

        const isScreenBg =
          key.includes("container") ||
          key.includes("wrapper") ||
          key.includes("scroll") ||
          key.includes("keyboard") ||
          key.includes("center") ||
          key.includes("loading");
        const isCard =
          key.includes("card") ||
          key.includes("box") ||
          key.includes("panel") ||
          key.includes("item") ||
          key.includes("badge") ||
          key.includes("placeholder") ||
          key.includes("section");
        const isInput =
          key.includes("input") ||
          key.includes("passwordbox") ||
          key.includes("field");
        const isPrimaryButton =
          key.includes("savebutton") ||
          key.includes("loginbutton") ||
          key.includes("detailsbutton") ||
          key.includes("quickbutton") ||
          key.includes("editbutton") ||
          key.includes("addbutton") ||
          key.includes("confirmbutton") ||
          key.includes("buttonactive");
        const isDanger =
          key.includes("logout") ||
          key.includes("delete") ||
          key.includes("danger") ||
          key.includes("remove");
        const isText =
          key.includes("text") ||
          key.includes("title") ||
          key.includes("label") ||
          key.includes("subtitle") ||
          key.includes("name") ||
          key.includes("role") ||
          key.includes("description") ||
          key.includes("date") ||
          key.includes("location") ||
          key.includes("value") ||
          key.includes("number");
        const isSecondaryText =
          key.includes("subtitle") ||
          key.includes("secondary") ||
          key.includes("muted") ||
          key.includes("emptytext") ||
          key.includes("description") ||
          key.includes("label") ||
          key.includes("placeholder");
        const isAccentText =
          key.includes("role") ||
          key.includes("date") ||
          key.includes("money") ||
          key.includes("primary") ||
          key.includes("active") ||
          key.includes("logout");

        if (isScreenBg) style.backgroundColor = colors.background;
        if (isCard) style.backgroundColor = colors.card;
        if (isInput) style.backgroundColor = colors.input;
        if (isPrimaryButton) style.backgroundColor = colors.primary;
        if (isDanger) style.backgroundColor = colors.danger;

        if (key.includes("border") || isCard || isInput)
          style.borderColor = colors.border;

        if (isText) style.color = colors.text;
        if (isSecondaryText) style.color = colors.secondary;
        if (isAccentText) style.color = colors.primary;
        if (isDanger && isText) style.color = colors.danger;

        return style;
      },
    },
  ) as Record<string, any>;
}
