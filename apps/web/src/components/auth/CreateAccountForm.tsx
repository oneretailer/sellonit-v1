'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRegistration } from './RegistrationFlow';
import { Field } from './Field';
import { isEmail, isName, isPassword } from '@/lib/auth/validation';

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
};

const FIELD_ORDER: Array<keyof FieldErrors> = ['firstName', 'lastName', 'email', 'password'];

export function CreateAccountForm() {
  const { dispatch, next: advance } = useRegistration();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function clearFieldError(field: keyof FieldErrors) {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!isName(firstName)) {
      next.firstName = 'Enter your first name.';
    }
    if (!isName(lastName)) {
      next.lastName = 'Enter your last name.';
    }
    if (!isEmail(email)) {
      next.email = 'Enter a valid email address.';
    }
    if (!isPassword(password)) {
      next.password = 'Use at least 8 characters.';
    }
    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitForm();
  }

  function submitForm() {
    if (submitting) {
      return;
    }
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const firstInvalid = FIELD_ORDER.find((field) => next[field]);
      if (firstInvalid) {
        document.getElementById(firstInvalid)?.focus();
      }
      return;
    }
    setSubmitting(true);
    dispatch({
      type: 'details',
      details: {
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      },
    });
    advance('/auth/register');
  }

  return (
    <div>
      <h1 className="card-title">Create your account</h1>
      <p className="card-subtitle">
        Enter your account details. Next, you can optionally add a phone number.
      </p>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-row">
          <Field
            id="firstName"
            label="First name"
            value={firstName}
            onChange={(value) => {
              setFirstName(value);
              clearFieldError('firstName');
            }}
            error={errors.firstName}
            autoComplete="given-name"
            placeholder="Ada"
            maxLength={80}
          />
          <Field
            id="lastName"
            label="Last name"
            value={lastName}
            onChange={(value) => {
              setLastName(value);
              clearFieldError('lastName');
            }}
            error={errors.lastName}
            autoComplete="family-name"
            placeholder="Eze"
            maxLength={80}
          />
        </div>
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            clearFieldError('email');
          }}
          error={errors.email}
          helper="We'll send a verification link to this address."
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            clearFieldError('password');
          }}
          error={errors.password}
          helper="At least 8 characters."
          autoComplete="new-password"
          placeholder="Create a password"
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Continuing…
            </>
          ) : (
            'Continue'
          )}
        </button>
      </form>
      <p className="card-footer">
        Already have an account?{' '}
        <Link className="link" href="/auth/login">
          Log in
        </Link>
      </p>
    </div>
  );
}
