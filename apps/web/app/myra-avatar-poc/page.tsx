import type { Metadata } from "next";
import { MyraAvatarPoc } from "./MyraAvatarPoc";

export const metadata: Metadata = {
  title: "Myra Avatar POC",
  robots: { index: false, follow: false },
};

export default function MyraAvatarPocPage() {
  return <MyraAvatarPoc />;
}
