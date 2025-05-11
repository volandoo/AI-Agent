import type {
	AgentRequest,
	AgentResponse,
	AgentContext,
	Json,
} from "@agentuity/sdk";
import dayjs from "dayjs";
import OpenAI from "openai";
import { type BestTracksResponseType, type NormalizedTrackType } from "./types";

const client = new OpenAI();

const normalizeDuration = (ms: number) => {
	const hours = Math.floor(ms / 3600000);
	const minutes = Math.floor((ms % 3600000) / 60000);
	const seconds = Math.floor((ms % 60000) / 1000);
	return `${hours}h ${minutes}m ${seconds}s`;
};

const capitalizeFirstLetterOfEachWord = (str: string) => {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};
export default async function Agent(
	req: AgentRequest,
	resp: AgentResponse,
	ctx: AgentContext
) {
	const from = dayjs().subtract(1, "week").startOf("day").valueOf();
	const to = dayjs().endOf("day").valueOf();

	const bestTracks = await fetch(
		`https://api.volandoo.com/v1/tracks/best?from=${from}&to=${to}&limit=${6}`,
		{
			headers: {
				"x-secret-key": process.env.SERVER_KEY ?? "",
				"Content-Type": "application/json",
			},
		}
	).then((res) => res.json() as Promise<BestTracksResponseType>);

	const normalizedTracks = bestTracks.data.tracks
		.map((t) => {
			const firstFlight = t.flights[0];
			if (!firstFlight) {
				return null;
			}
			return {
				id: t.id,
				image_link: `https://ik.imagekit.io/tcixzkbxb/prod/screenshots/${t.id}.jpg`,
				pilot_name: t.pilot.name,
				track_link: `https://volandoo.com/tracks/${t.id}`,
				profile_link: `https://volandoo.com/pilots/${t.pilot.id}`,
				site: capitalizeFirstLetterOfEachWord(firstFlight.site.name),
				type:
					t.wpts > 0
						? "competition"
						: t.mode === "h&f"
						? "Hike & Fly"
						: capitalizeFirstLetterOfEachWord(firstFlight.type ?? "Unknown"),
				distance: [
					...t.flights.map((f) => f.distance),
					...t.hikes.map((h) => h.distance),
				].reduce((a, b) => a + b, 0),
				duration: normalizeDuration(t.ended - t.started),
				waypoint_count: t.wpts > 0 ? t.wpts : undefined,
				made_goal: t.wpts > 0 ? t.atGoal > 0 : undefined,
				flight_count: t.flights.length,
				hike_count: t.hikes.length,
				glider_name: t.wing,
				thermal_count: t.thermalCount,
			};
		})
		.filter(Boolean) as NormalizedTrackType[];
	const system = `
You are a blogger for Volandoo. Volandoo is a live tracking platform for hang gliding and paragliding. It also has a logbooks for the pilots to keep
track of their flights. Not only this, but Volandoo is also a social network where pilots can comment and like each other's flights.
`;
	const prompt = `
Write a weekly blog post summarizing the top 6 flights of the week on the Volandoo platform. Start the post with a short,
friendly 3-4 sentence introduction, and then write a 4-5 sentence paragraph for each flight. The most important paramenters to talk about are distance, duration,
name of the pilot, name of the glider, and the site. But please use all the paramenters you consider relevant. Use the image link to show a screenshot of the flight, 
link to the flight track on the image, and the link to the pilot's profile as  well somewhere in the post. If the flight is a competition, mention if the pilot made goal or not.

This is the week of ${new Date(
		from
	).toDateString()}, and eventhough we're only showing the top 6 flights, there are ${
		bestTracks.data.total
	} flights in total, mention this.

Tone: Friendly, engaging, and community-centered. Celebrate the achievements, and vary phrasing to keep each paragraph unique.
Note: If there are several flights from the same pilot, only mention the best one.

The response needs to be a json object with the following exact fields:
- title: string - needs to be short and catchy
- brief: string - needs to be short, 2 or 3 sentences
- content: markdown formatted string with the blog post
- image: first image link of the post

Here are the tracks:

	${JSON.stringify(normalizedTracks)}
	`;

	console.log(prompt);
	const completion = await client.chat.completions.create({
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: prompt },
		],
		model: "gpt-4.1-mini",
	});
	let message = completion.choices[0]?.message?.content;

	if (message?.startsWith("```json")) {
		// remove first 7 characters
		message = message.slice(7);
	}
	if (message?.endsWith("```")) {
		// remove last 3 characters
		message = message.slice(0, -3);
	}

	const json = JSON.parse(message ?? "{}");

	if (json.title && json.brief && json.content && json.image) {
		const response = await fetch("https://api.volandoo.com/v1/blog", {
			method: "POST",
			body: JSON.stringify({
				title: json.title,
				brief: json.brief,
				content: json.content,
				image: json.image,
				author: "Volandoo AI",
			}),
			headers: {
				"x-secret-key": process.env.SERVER_KEY ?? "",
				"Content-Type": "application/json",
			},
		}).then((res) => res.json());

		return resp.json(response as Json);
	}

	return resp.text("Something went wrong");
}
