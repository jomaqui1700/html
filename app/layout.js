import './globals.css'

export const metadata = {
  title: 'Ganadera San Ramón',
  description: 'Gestión de fincas, café y ganado'
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
