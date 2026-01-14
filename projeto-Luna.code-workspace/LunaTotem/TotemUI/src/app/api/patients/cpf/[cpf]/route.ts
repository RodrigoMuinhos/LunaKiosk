export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { normalizeCpf, readPatients } from '../../patientStore';

type Params = {
  params: {
    cpf: string;
  };
};

export async function GET(_: Request, { params }: Params) {
  const cpfDigits = normalizeCpf(params.cpf);
  const patients = await readPatients();
  const patient = patients.find((item) => item.cpf === cpfDigits);
  if (!patient) {
    return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 });
  }
  const { createdAt, updatedAt, ...rest } = patient;
  return NextResponse.json(rest);
}
