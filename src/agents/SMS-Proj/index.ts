import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';
import OpenAI from "openai";

const client = new OpenAI();

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {

  const sms = await req.data.sms();
  if (sms) {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant that can answer questions and help with tasks." },
        { role: "user", content: `What do you think about ${sms.text}?` }
      ],
      model: "gpt-4.1-mini",
    });
    const response = completion.choices[0]?.message.content ?? '';
    sms.sendReply(req, ctx, response)
    return resp.text('done');
  }

  return resp.text('Hello from Agentuity!');
}
