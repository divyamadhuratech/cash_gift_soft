export const currentTime = () =>
  new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date());

export const todayISO = () => new Date().toISOString().slice(0, 10);