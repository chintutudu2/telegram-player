type ClassValue = string | false | null | undefined;

/** Joins conditional class names. */
export const cn = (...classes: ClassValue[]) => classes.filter(Boolean).join(" ");
