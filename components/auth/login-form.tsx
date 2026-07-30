"use client"

import { prepareDemoAccountAction, signInToDemoAction } from "@/app/(auth)/demo-actions"
import { FormError } from "@/components/forms/error"
import { FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { ArrowRight, KeyRound, Loader2, Mail, Wand2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

type Method = "code" | "password"

export function LoginForm({ defaultEmail, isDemoEnabled = false }: { defaultEmail?: string; isDemoEnabled?: boolean }) {
  const [method, setMethod] = useState<Method>("code")
  const [email, setEmail] = useState(defaultEmail || "")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPreparingDemo, startDemoTransition] = useTransition()
  const router = useRouter()

  const switchMethod = (next: Method) => {
    setMethod(next)
    setError(null)
    setIsOtpSent(false)
    setOtp("")
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })
      if (result.error) {
        // better-auth reports "user not found" for unknown addresses; keep the
        // wording vague so the form can't be used to probe for accounts.
        setError("We couldn't send a code to that address. Check the spelling and try again.")
        return
      }
      setIsOtpSent(true)
    } catch (err) {
      console.error("Sending the sign-in code failed:", err)
      setError("We couldn't send your code just now. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await authClient.signIn.emailOtp({ email, otp })
      if (result.error) {
        setError("That code is incorrect or has expired. Request a new one.")
        return
      }
      router.push("/dashboard")
    } catch (err) {
      console.error("Verifying the sign-in code failed:", err)
      setError("We couldn't check that code just now. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await authClient.signIn.email({ email, password })
      if (result.error) {
        setError("That email and password don't match. Please try again.")
        return
      }
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      console.error("Password sign-in failed:", err)
      setError("We couldn't sign you in just now. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  /** Fills the form with the demo credentials so they are visible before use. */
  const fillDemoCredentials = () => {
    setError(null)
    startDemoTransition(async () => {
      const result = await prepareDemoAccountAction()
      if (!result.success) {
        setError(result.error)
        return
      }
      switchMethod("password")
      setEmail(result.credentials.email)
      setPassword(result.credentials.password)
      setNotice("Demo credentials filled in — press Sign in to continue.")
    })
  }

  const enterDemoDirectly = () => {
    setError(null)
    startDemoTransition(async () => {
      const result = await signInToDemoAction()
      if (!result.success) {
        setError(result.error || "Could not open the demo workspace")
        return
      }
      router.push("/dashboard")
      router.refresh()
    })
  }

  const onSubmit = method === "password" ? handlePasswordSignIn : isOtpSent ? handleVerifyOtp : handleSendOtp

  return (
    <div className="flex w-full flex-col gap-6">
      {isDemoEnabled && (
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-sm font-semibold">Just looking around?</p>
          <p className="text-sm text-muted-foreground">
            Open a fully populated workspace — a year of books, receipts and reports. No signup required.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={enterDemoDirectly} disabled={isPreparingDemo} className="gap-2">
              {isPreparingDemo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Enter demo workspace
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={fillDemoCredentials}
              disabled={isPreparingDemo}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Fill demo credentials
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={method === "code"}
          onClick={() => switchMethod("code")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            method === "code" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Mail className="h-4 w-4" />
          Email code
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "password"}
          onClick={() => switchMethod("password")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            method === "password" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <KeyRound className="h-4 w-4" />
          Password
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
        <FormInput
          title="Work email"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isOtpSent}
        />

        {method === "password" && (
          <FormInput
            title="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}

        {method === "code" && isOtpSent && (
          <FormInput
            title="Six-digit code from your email"
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            maxLength={6}
            pattern="[0-9]{6}"
          />
        )}

        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {method === "password" ? "Sign in" : isOtpSent ? "Verify code" : "Email me a code"}
        </Button>

        {notice && !error && <p className="text-center text-sm text-muted-foreground">{notice}</p>}
        {error && <FormError className="text-center">{error}</FormError>}
      </form>
    </div>
  )
}
