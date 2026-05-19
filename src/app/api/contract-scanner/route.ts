import { scanContractFormData } from "@/lib/api/contract-scanner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  return scanContractFormData(await req.formData());
}
