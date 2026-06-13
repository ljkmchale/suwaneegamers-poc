import type { Metadata } from "next";
import CalendarPage from "./calendar/page";

export const metadata: Metadata = {
  title: "Suwanee Gamers",
  description: "Suwanee Gamers Calendar for upcoming DND sessions and table events.",
};

// Revalidate every 5 minutes to stay current with the Google Calendar feed.
export const revalidate = 300;

export default CalendarPage;
