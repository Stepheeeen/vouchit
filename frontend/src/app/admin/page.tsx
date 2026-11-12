import { redirect } from "next/navigation";

/**
 * `/admin` is the URL people actually type.
 *
 * There was no page here — only `/admin/disputes` — so typing the obvious
 * address produced "This page doesn't exist", which reads as "you have no
 * admin panel" rather than "you guessed the wrong path". There is also no
 * link to the panel anywhere unless the nav has already decided you are an
 * admin, so a moderator who could not see that link had no way at all to
 * reach the page.
 *
 * A redirect rather than a landing page: there is one admin surface, and a
 * menu listing a single item is not worth the extra click.
 */
export default function AdminIndexPage() {
  redirect("/admin/disputes");
}
