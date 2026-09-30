import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ping Pong BlueBoot",
    short_name: "Ping Pong",
    description: "Ranking ELO de ping pong de BlueBoot.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#028BB8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
