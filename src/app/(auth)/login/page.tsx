import type { Metadata } from "next";
import { AuthForms } from "./auth-forms";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return <AuthForms linkError={error === "link"} />;
}
