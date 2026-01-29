import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Clock, BookOpen, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useOnboarding } from '@/contexts/OnboardingContext'
import api from '@/lib/api'

const FALLBACK_QUOTES = [
  { verse: "Jeremiah 29:11", text: "For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future." },
  { verse: "Philippians 4:13", text: "I can do all things through Christ who strengthens me." },
  { verse: "Proverbs 3:5-6", text: "Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight." },
  { verse: "Isaiah 41:10", text: "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you." },
  { verse: "Psalm 23:1", text: "The LORD is my shepherd, I lack nothing." },
]

function getFallbackQuote(): { verse: string; text: string } {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  const index = dayOfYear % FALLBACK_QUOTES.length
  return FALLBACK_QUOTES[index]
}

function getStorageKey(userId: number): string {
  const today = new Date().toISOString().split('T')[0]
  return `daily_greeting_shown_${userId}_${today}`
}

export function DailyGreetingToast() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { isOnboarding, hasCompletedOnboarding } = useOnboarding()
  const [isVisible, setIsVisible] = useState(false)
  const [quote, setQuote] = useState<{ verse: string; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    
    // Don't show greeting while onboarding is active - wait for it to complete
    if (isOnboarding) return

    const storageKey = getStorageKey(user.id)
    const alreadyShown = localStorage.getItem(storageKey)

    if (!alreadyShown) {
      // Fetch verse from API (Groq-powered)
      const fetchVerse = async () => {
        try {
          const response = await api.get('/daily-verse')
          setQuote({ verse: response.data.verse, text: response.data.text })
        } catch (error) {
          console.log('Using fallback verse')
          setQuote(getFallbackQuote())
        } finally {
          setIsLoading(false)
        }
      }
      
      fetchVerse()
      
      // Delay greeting to show after onboarding is done
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [user?.id, isOnboarding])

  const handleDismiss = () => {
    if (user?.id) {
      localStorage.setItem(getStorageKey(user.id), 'true')
    }
    setIsVisible(false)
  }

  const handleStartDay = () => {
    handleDismiss()
    navigate('/attendance')
  }

  if (!isVisible || !user) return null

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-background via-background to-primary/5 border-2 border-primary/20 rounded-2xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-500">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-8 py-6 border-b border-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">
                {getGreeting()}, {user.first_name}!
              </h2>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted/50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-7 space-y-6">
          {/* Clock-in Reminder */}
          <div className="flex items-start gap-4 p-5 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Clock className="h-6 w-6 text-primary shrink-0" />
            </div>
            <div>
              <p className="text-base font-semibold mb-1">Remember to clock in</p>
              <p className="text-sm text-muted-foreground">
                Don't forget to mark your attendance for today.
              </p>
            </div>
          </div>

          {/* Bible Quote */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold uppercase tracking-wider">Today's Inspiration</span>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : quote ? (
              <blockquote className="relative pl-6 py-4 border-l-4 border-primary/40 bg-gradient-to-r from-primary/5 to-transparent rounded-r-lg">
                <p className="text-base text-foreground italic leading-relaxed font-medium">
                  "{quote.text}"
                </p>
                <footer className="mt-3 text-sm text-primary font-semibold">
                  — {quote.verse}
                </footer>
              </blockquote>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-gradient-to-r from-primary/5 to-transparent border-t border-primary/10">
          <button
            onClick={handleStartDay}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl font-semibold text-base hover:from-primary/90 hover:to-primary/80 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          >
            Start My Day
          </button>
        </div>
      </div>
    </div>
  )
}
