import { describe, it, expect } from 'vitest'
import loginSource from '../pages/Login.tsx?raw'

describe('Login Credentials and Form Pre-fill Verification', () => {
  it('guarantees login form state initializes with strictly empty strings', () => {
    // 1. O estado de email de login deve iniciar com string vazia
    expect(loginSource).toMatch(/const\s+\[email,\s*setEmail\]\s*=\s*useState\(["']["']\)/)

    // 2. O estado de password de login deve iniciar com string vazia
    expect(loginSource).toMatch(/const\s+\[password,\s*setPassword\]\s*=\s*useState\(["']["']\)/)

    // 3. O estado de recuperação de senha deve iniciar com string vazia
    expect(loginSource).toMatch(/const\s+\[forgotEmail,\s*setForgotEmail\]\s*=\s*useState\(["']["']\)/)
  })

  it('ensures no hardcoded admin/demo credentials exist in Login.tsx', () => {
    // Nenhuma menção a luka2510 ou hotmail ou credenciais padrão no código de Login
    expect(loginSource.toLowerCase()).not.toContain('luka2510')
    expect(loginSource.toLowerCase()).not.toContain('@hotmail.com')
    expect(loginSource).not.toMatch(/initialValue/i)
    expect(loginSource).not.toMatch(/defaultValue\s*=\s*["'][^"']+["']/i) // apenas Tabs defaultValue="login" é permitido
  })

  it('verifies login input fields have appropriate autoComplete attributes', () => {
    // O campo de login de email deve ter autoComplete="email"
    expect(loginSource).toMatch(/id="login-email"[^>]*autoComplete="email"/s)

    // O campo de senha deve ter autoComplete="current-password"
    expect(loginSource).toMatch(/id="login-password"[^>]*autoComplete="current-password"/s)
  })

  it('ensures all 3 tabs and brand features remain intact', () => {
    // As 3 abas ("Entrar", "Criar Empresa", "Cadastro Contek") continuam presentes
    expect(loginSource).toContain('value="login"')
    expect(loginSource).toContain('value="signup"')
    expect(loginSource).toContain('value="manual"')
    expect(loginSource).toContain('Entrar')
    expect(loginSource).toContain('Criar Empresa')
    expect(loginSource).toContain('Cadastro Contek')

    // Link e fluxo "Esqueci minha senha"
    expect(loginSource).toContain('Esqueci minha senha')
    expect(loginSource).toContain('Recuperar Senha')

    // Suporte às marcas AGYLI e MARKALY
    expect(loginSource).toContain("setActiveBrand('agyli')")
    expect(loginSource).toContain("setActiveBrand('markaly')")
  })
})
