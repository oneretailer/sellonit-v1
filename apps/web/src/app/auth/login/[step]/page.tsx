import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoginStepView } from '@/components/login/LoginStepView';
import { isLoginStepId, LOGIN_STEPS } from '@/components/login/loginSteps';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOGIN_STEPS.map((step) => ({ step: step.id }));
}

type LoginStepPageProps = {
  params: Promise<{ step: string }>;
};

export async function generateMetadata({ params }: LoginStepPageProps): Promise<Metadata> {
  const { step } = await params;
  const definition = LOGIN_STEPS.find((candidate) => candidate.id === step);
  return { title: definition?.title ?? 'Log in' };
}

export default async function LoginStepPage({ params }: LoginStepPageProps) {
  const { step } = await params;
  if (!isLoginStepId(step)) {
    notFound();
  }
  return <LoginStepView stepId={step} />;
}
