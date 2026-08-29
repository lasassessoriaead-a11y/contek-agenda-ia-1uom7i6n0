import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { Client, Appointment } from '@/types'
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  Clock,
  ChevronRight,
  Edit2,
  Trash2,
  History,
  Sparkles,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Clientes: React.FC = () => {
  const { organization } = useAuth()
  const orgId = organization?.id

  const [clients, setClients] = useState<Client[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  // Selected client for history view
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [historySheetOpen, setHistorySheetOpen] = useState(false)

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [clientsRes, apptsRes] = await Promise.all([
        pb.collection('clients').getFullList<Client>({
          filter: `organization_id = "${orgId}"`,
          sort: 'name',
        }),
        pb.collection('appointments').getFullList<Appointment>({
          filter: `organization_id = "${orgId}"`,
          sort: '-date,-start_time',
          expand: 'service_id,professional_id',
        }),
      ])
      setClients(clientsRes)
      setAppointments(apptsRes)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [orgId])

  const openCreateModal = () => {
    setIsEditing(false)
    setEditId(null)
    setName('')
    setPhone('')
    setWhatsapp('')
    setEmail('')
    setBirthDate('')
    setNotes('')
    setModalOpen(true)
  }

  const openEditModal = (client: Client) => {
    setIsEditing(true)
    setEditId(client.id)
    setName(client.name)
    setPhone(client.phone)
    setWhatsapp(client.whatsapp || client.phone)
    setEmail(client.email || '')
    setBirthDate(client.birth_date ? client.birth_date.slice(0, 10) : '')
    setNotes(client.notes || '')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !name.trim() || !phone.trim()) {
      toast.error('Nome e telefone são obrigatórios.')
      return
    }

    setSaving(true)
    try {
      const data = {
        organization_id: orgId,
        name: name.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || phone.trim(),
        email: email.trim(),
        birth_date: birthDate ? birthDate + ' 00:00:00.000Z' : null,
        notes: notes.trim(),
      }

      if (isEditing && editId) {
        await pb.collection('clients').update(editId, data)
        toast.success('Cliente atualizado com sucesso!')
      } else {
        await pb.collection('clients').create(data)
        toast.success('Cliente cadastrado com sucesso!')
      }

      setModalOpen(false)
      await loadData()
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao salvar cliente.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este cliente?')) return
    try {
      await pb.collection('clients').delete(id)
      toast.success('Cliente removido.')
      if (selectedClient?.id === id) setHistorySheetOpen(false)
      await loadData()
    } catch (err) {
      toast.error('Erro ao excluir cliente.')
    }
  }

  const filteredClients = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)),
    )
  }, [clients, searchTerm])

  const clientHistory = useMemo(() => {
    if (!selectedClient) return []
    return appointments.filter((a) => a.client_id === selectedClient.id)
  }, [appointments, selectedClient])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Clientes
          </h1>
          <p className="text-xs text-slate-500">
            Base de clientes de{' '}
            <span className="font-semibold text-slate-700">{organization?.name}</span> (
            {clients.length} cadastrados).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Buscar por nome, telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs bg-white"
            />
          </div>

          <Button
            size="sm"
            onClick={openCreateModal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* CLIENTS TABLE / CARDS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Nenhum cliente encontrado</p>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre seus clientes para gerenciar histórico e agendamentos.
            </p>
            <Button
              size="sm"
              onClick={openCreateModal}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
            >
              Cadastrar Primeiro Cliente
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Telefone / WhatsApp</th>
                  <th className="py-3 px-4 hidden md:table-cell">E-mail</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Histórico</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredClients.map((client) => {
                  const clientApptsCount = appointments.filter(
                    (a) => a.client_id === client.id,
                  ).length

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedClient(client)
                        setHistorySheetOpen(true)
                      }}
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                            {client.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span>{client.name}</span>
                            {client.notes && (
                              <p className="text-[10px] text-slate-400 font-normal truncate max-w-xs">
                                {client.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-800">
                        {client.whatsapp || client.phone}
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell text-slate-500">
                        {client.email || '-'}
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <Badge
                          variant="secondary"
                          className="bg-slate-100 text-slate-700 text-[10px]"
                        >
                          {clientApptsCount} agendamento(s)
                        </Badge>
                      </td>
                      <td
                        className="py-3.5 px-4 text-right space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedClient(client)
                            setHistorySheetOpen(true)
                          }}
                          className="text-xs h-7 px-2 text-emerald-700 hover:bg-emerald-50"
                        >
                          <History className="w-3.5 h-3.5 mr-1" />
                          Histórico
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(client)}
                          className="text-xs h-7 px-2 text-slate-600 hover:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(client.id)}
                          className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CLIENT HISTORY SHEET */}
      <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selectedClient && (
            <div className="space-y-6 pt-4">
              <SheetHeader>
                <SheetTitle className="text-xl text-slate-900 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    {selectedClient.name.slice(0, 2).toUpperCase()}
                  </div>
                  {selectedClient.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500">
                  Histórico completo de atendimentos e dados de contato
                </SheetDescription>
              </SheetHeader>

              {/* Info Box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    Telefone:
                  </span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {selectedClient.phone}
                  </span>
                </div>
                {selectedClient.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      E-mail:
                    </span>
                    <span className="font-semibold text-slate-900">{selectedClient.email}</span>
                  </div>
                )}
                {selectedClient.notes && (
                  <div className="pt-1 text-slate-600 border-t border-slate-200">
                    <span className="font-semibold text-slate-700 block mb-0.5">Observações:</span>
                    <p className="italic bg-white p-2 rounded border border-slate-200">
                      {selectedClient.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Appointments History List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-600" />
                  Histórico de Agendamentos ({clientHistory.length})
                </h4>

                {clientHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">
                    Nenhum agendamento registrado para este cliente ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {clientHistory.map((appt) => (
                      <div
                        key={appt.id}
                        className="p-3 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 transition-all text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">
                            {appt.expand?.service_id?.name || 'Serviço'}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            {appt.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {appt.date ? format(parseISO(appt.date), 'dd/MM/yyyy') : '-'} às{' '}
                          {appt.start_time} • {appt.expand?.professional_id?.name}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-600">
                          <span>
                            Valor:{' '}
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(appt.price)}
                          </span>
                          <span className="text-[10px] text-slate-400">{appt.duration} min</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* CREATE / EDIT CLIENT MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Cadastro cadastral de clientes da organização.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nome Completo *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do cliente"
                  required
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Telefone / Celular *
                  </Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-8888"
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">WhatsApp</Label>
                  <Input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(11) 99999-8888"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">E-mail</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Data de Nascimento (opcional)
                  </Label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferências, recomendações..."
                  className="text-xs h-20 resize-none"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
              >
                {saving ? 'Salvando...' : isEditing ? 'Atualizar Cliente' : 'Salvar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Clientes
