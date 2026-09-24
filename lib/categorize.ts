const rules: Array<[string, RegExp]> = [
  ["Alimentación", /tottus|wong|metro|plaza vea|vivanda|restaurante|café|coffee|burger|pizza|rappi|pedidosya/i],
  ["Transporte", /cabify|uber|didi|taxi|repsol|primax|grifo|latam|sky airline/i],
  ["Hogar", /sodimac|promart|luz del sur|enel|calidda|movistar|claro|win internet/i],
  ["Salud", /inkafarma|mifarma|farmacia|clínica|clinica|laboratorio|doctor/i],
  ["Entretenimiento", /netflix|spotify|disney|hbo|cineplanet|cinemark|steam|playstation/i],
  ["Compras", /mercado libre|falabella|ripley|oechsle|amazon|aliexpress/i],
  ["Educación", /universidad|instituto|udemy|coursera|libro/i],
];

export function categorize(merchant: string, description = ""): string {
  const text = `${merchant} ${description}`;
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? "Otros";
}
