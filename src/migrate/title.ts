const SEPARATOR = " - ";

export function splitCompanyRole(title: string): { company: string; role: string } {
  const index = title.indexOf(SEPARATOR);
  if (index === -1) return { company: "", role: title.trim() };
  return {
    company: title.slice(0, index).trim(),
    role: title.slice(index + SEPARATOR.length).trim(),
  };
}
