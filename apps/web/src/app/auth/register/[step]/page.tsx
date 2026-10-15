import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegisterStepView } from '@/components/register/RegisterStepView';
import { isRegisterStepId, REGISTER_STEPS } from '@/components/register/registerSteps';

export const dynamicParams = false;

export function generateStaticParams() {
  return REGISTER_STEPS.map((step) => ({ step: step.id }));
}

type RegisterStepPageProps = {
  params: Promise<{ step: string }>;
};

export async function generateMetadata({ params }: RegisterStepPageProps): Promise<Metadata> {
  const { step } = await params;
  const definition = REGISTER_STEPS.find((candidate) => candidate.id === step);
  return { title: definition?.title ?? 'Create your account' };
}

export default async function RegisterStepPage({ params }: RegisterStepPageProps) {
  const { step } = await params;
  if (!isRegisterStepId(step)) {
    notFound();
  }
  return <RegisterStepView stepId={step} />;
}
