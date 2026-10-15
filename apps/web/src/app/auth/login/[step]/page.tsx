import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoginStepView } from '@/components/login/LoginStepView';
import { isLoginStepId, LOGIN_STEPS } from '@/components/login/loginSteps';
import { isEmail } from '@/lib/auth/validation';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOGIN_STEPS.map((step) => ({ step: step.id }));
}

type LoginStepPageProps = {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ email?: string | string[] }>;
};

export async function generateMetadata({ params }: LoginStepPageProps): Promise<Metadata> {
  const { step } = await params;
  const definition = LOGIN_STEPS.find((candidate) => candidate.id === step);
  return { title: definition?.title ?? 'Log in' };
}

export default async function LoginStepPage({ params, searchParams }: LoginStepPageProps) {
  const { step } = await params;
  if (!isLoginStepId(step)) {
    notFound();
  }
  // Only a well-formed email is accepted from the query string. Never a password.
  const { email } = await searchParams;
  const value = Array.isArray(email) ? email[0] : email;
  const initialEmail = value && isEmail(value) ? value : undefined;
  return <LoginStepView stepId={step} initialEmail={initialEmail} />;
}
