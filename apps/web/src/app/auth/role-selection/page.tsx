import type { Metadata } from 'next';
import { RequireAuthenticatedSession } from '@/components/auth/RequireAuthenticatedSession';
import { RoleSelectionForm } from '@/components/onboarding/RoleSelectionForm';
import { AuthPage } from '@/components/reuseable/AuthPage';

export const metadata: Metadata = {
  title: 'Role selection',
  description: 'Choose how you will use Sellonit.',
};
export default function RoleSelectionPage() {
  return (

 <AuthPage rightLink={{ label: 'Role selection', variant: 'text', className: 'text-base' }}>
     <div className ="pt-15 w-full flex items-center justify-center">
      <RequireAuthenticatedSession>
        <RoleSelectionForm />
        
      </RequireAuthenticatedSession>
      </div>
    </AuthPage>
   
  );
}
