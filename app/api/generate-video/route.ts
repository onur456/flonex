import { asJsonRecord } from "@/lib/fal";
import { generateVideoResponse } from "@/lib/generateFalMedia";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = asJsonRecord(await request.json().catch(() => ({})));
  return generateVideoResponse(body);
}
