import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-xs space-y-4">
          <img src="/kountry-logo.png" alt="Kountry Eyecare" className="w-48 mx-auto" />
          <LoginForm />
        </div>
      </div>
      <div className="relative hidden lg:block">
        <img 
          src="/login.jpg" 
          alt="Eye examination" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-8 left-8 right-8 text-white">
          <h2 className="text-3xl font-bold mb-2">Kountry Eyecare</h2>
          <p className="text-white/80">Integrated Clinic Management System</p>
        </div>
      </div>
    </div>
  )
}
