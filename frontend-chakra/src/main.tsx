import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, ColorModeScript, createStandaloneToast } from '@chakra-ui/react'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import theme from './theme/theme'
import App from './App'
import { apiErrorMessage } from './lib/errors'

const { ToastContainer, toast } = createStandaloneToast({ theme })

const queryClient = new QueryClient({
  // Any action that fails without its own error handling still tells the user why
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return
      toast({ title: 'Action failed', description: apiErrorMessage(error), status: 'error', position: 'top-right', isClosable: true })
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
      <ToastContainer />
    </ChakraProvider>
  </React.StrictMode>,
)
