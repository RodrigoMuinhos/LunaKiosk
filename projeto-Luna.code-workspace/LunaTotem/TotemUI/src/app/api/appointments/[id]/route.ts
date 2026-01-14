export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { Appointment } from '@/lib/api';
import { readAppointments, writeAppointments } from '../appointmentStore';

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const appointments = await readAppointments();
  const appointment = appointments.find((item) => item.id === params.id);
  if (!appointment) {
    return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 });
  }
  return NextResponse.json(appointment);
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const payload = (await request.json()) as Partial<Appointment>;
    const appointments = await readAppointments();
    const index = appointments.findIndex((item) => item.id === params.id);
    if (index === -1) {
      return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 });
    }

    const current = appointments[index];
    const updated: Appointment = {
      ...current,
      ...payload,
      amount:
        payload.amount !== undefined ? Number(payload.amount) : current.amount,
      paid: payload.paid !== undefined ? Boolean(payload.paid) : current.paid,
    };

    appointments[index] = updated;
    await writeAppointments(appointments);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar consulta', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar consulta.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const appointments = await readAppointments();
  const index = appointments.findIndex((item) => item.id === params.id);
  if (index === -1) {
    return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 });
  }
  appointments.splice(index, 1);
  await writeAppointments(appointments);
  return NextResponse.json({ success: true });
}
