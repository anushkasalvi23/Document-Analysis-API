import { SignUp, useAuth } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

export default function SignUpPage() {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
      </div>
    )
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex min-h-dvh w-full items-start justify-center overflow-x-hidden bg-gray-50 px-4 py-8 sm:items-center sm:py-12">
      <div className="w-full max-w-md shrink-0">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </div>
  )
}
