import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, Calendar, ArrowRight, ShieldCheck, CheckCircle2, Lock, Mail, Building2, User } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

export const LoginPublic: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingLogin, setLoadingLogin] = useState(false)

  const [signupOrgName, setSignupOrgName] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [loadingSignup, setLoadingSignup] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Preencha seu e-mail e senha.')
      return
    }
    setLoadingLogin(true)
    try {
      await login(email, password)
      toast.success('Bem-vindo ao Contek Agenda IA!')
      navigate('/')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível entrar. Verifique suas credenciais ou contate a Contek.')
    } finally {
      setLoadingLogin(false)
    }
  }

  const handleSelfServiceSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signupOrgName || !signupName || !signupEmail || !signupPassword) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    if (signupPassword.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    setLoadingSignup(true)
    try {
      const cleanSlug =
        signupOrgName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') +
        '-' +
        Math.floor(1000 + Math.random() * 9000)

      const org = await pb.collection('organizations').create({
        name: signupOrgName.trim(),
        slug: cleanSlug,
        phone: signupPhone.trim(),
        whatsapp: signupPhone.trim(),
        email: signupEmail.trim(),
        status: 'active',
        plan_id: 'trial_v1',
      })

      await pb.collection('business_settings').create({
        organization_id: org.id,
        business_name: signupOrgName.trim(),
        phone: signupPhone.trim(),
        whatsapp: signupPhone.trim(),
        opening_time: '08:00',
        closing_time: '19:00',
        working_days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
        slot_interval_minutes: 30,
        buffer_between_appointments: 10,
        default_booking_message: `Olá! Seu agendamento foi confirmado com sucesso na ${signupOrgName}.`,
        whatsapp_enabled: true,
      })

      await pb.collection('users').create({
        email: signupEmail.trim(),
        password: signupPassword,
        passwordConfirm: signupPassword,
        name: signupName.trim(),
        phone: signupPhone.trim(),
        role: 'ADMINISTRADOR',
        organization_id: org.id,
      })

      const prof = await pb.collection('professionals').create({
        organization_id: org.id,
        name: signupName.trim(),
        specialty: 'Especialista',
        phone: signupPhone.trim(),
        email: signupEmail.trim(),
        default_duration: 45,
        work_days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
        work_hours: { start: '08:00', end: '19:00' },
        active: true,
      })

      const serv = await pb.collection('services').create({
        organization_id: org.id,
        name: 'Atendimento Inicial / Consulta',
        description: 'Serviço padrão configurado automaticamente',
        duration: 45,
        price: 150,
        color: '#10b981',
        category: 'Geral',
        active: true,
      })

      await pb.collection('professional_services').create({
        organization_id: org.id,
        professional_id: prof.id,
        service_id: serv.id,
      })

      await login(signupEmail.trim(), signupPassword)
      toast.success('Empresa e conta criadas com sucesso!')
      navigate('/')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao cadastrar empresa. Este e-mail já pode estar em uso.')
    } finally {
      setLoadingSignup(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-semibold mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          Contek Tecnologia e Consultoria
        </div>
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <Calendar className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Contek Agenda IA</h1>
        </div>
        <p className="text-sm text-slate-400">Gestão e agendamento inteligente para prestadores de serviços</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 relative z-10">
        <Card className="border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-slate-100">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/80 p-1 border border-slate-700/50">
                <TabsTrigger value="login" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Entrar</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Criar Empresa</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4 pt-2">
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-lg flex items-center gap-3 text-xs text-emerald-300">
                    <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                    <p>Ambiente protegido por autenticação e isolamento por empresa.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> E-mail</Label>
                    <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Senha</Label>
                    <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500" />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 pt-2">
                  <Button type="submit" disabled={loadingLogin} className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold h-11">
                    {loadingLogin ? 'Entrando no sistema...' : 'Acessar Painel da Empresa'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <div className="text-center text-xs text-slate-400">Página pública de demonstração: <Link to="/agendar/contek-demo" className="text-emerald-400 hover:underline font-medium">abrir agendamento</Link></div>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSelfServiceSignup}>
                <CardContent className="space-y-3.5 pt-2">
                  <CardDescription className="text-slate-400 text-xs">Cadastre seu estabelecimento e comece a configurar sua agenda.</CardDescription>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-emerald-400" /> Nome do Estabelecimento / Empresa *</Label>
                    <Input value={signupOrgName} onChange={(e) => setSignupOrgName(e.target.value)} required className="bg-slate-950 border-slate-700 text-white" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Seu Nome *</Label><Input value={signupName} onChange={(e) => setSignupName(e.target.value)} required className="bg-slate-950 border-slate-700 text-white" /></div>
                    <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-300">WhatsApp / Telefone</Label><Input value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} className="bg-slate-950 border-slate-700 text-white" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-300">E-mail de Acesso *</Label><Input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required className="bg-slate-950 border-slate-700 text-white" /></div>
                    <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-300">Senha (mín. 8) *</Label><Input type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required className="bg-slate-950 border-slate-700 text-white" /></div>
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button type="submit" disabled={loadingSignup} className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold h-11">
                    {loadingSignup ? 'Criando sua conta...' : 'Cadastrar Empresa e Começar'}
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

export default LoginPublic
