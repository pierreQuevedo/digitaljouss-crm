import { LoginForm } from "@/components/auth/login-form"
import Image from "next/image"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import CoverLoginDark from "@/app/assets/cover-dj-vertical-dark.jpg"
import CoverLoginLight from "@/app/assets/cover-dj-vertical-light.jpg"
import LogoDJ from "@/app/assets/logo/logo-generique.svg"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="w-full flex justify-center gap-2 md:justify-between">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Image
              src={LogoDJ}
              alt="logo digitaljouss"
              className="w-32 h-auto"
            />
          </a>
          <AnimatedThemeToggler />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <Image
          src={CoverLoginDark}
          alt="Image"
          fill
          className="absolute inset-0 h-full w-full object-cover dark:hidden"
        />
        <Image
          src={CoverLoginLight}
          alt="Image"
          fill
          className="absolute inset-0 h-full w-full object-cover hidden dark:block"
        />
      </div>
    </div>
  )
}
