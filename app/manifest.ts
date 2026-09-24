import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lúmina Finanzas",
    short_name: "Lúmina",
    description: "Gastos de Gmail convertidos en claridad financiera.",
    start_url: "/app",
    display: "standalone",
    background_color: "#eef2f4",
    theme_color: "#102820",
    orientation: "portrait-primary",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
