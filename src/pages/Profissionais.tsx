import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { Professional, Service, ProfessionalService } from '@/types'
import {
  UserCheck,
  Plus,
  Phone,
  Mail,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Scissors,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

const ALL_DAYS = [
  { id: 'seg', label: 'Segunda' },
  { id: 'ter', label: 'Terça' },
  { id: 'qua', label: 'Quarta' },
  { id: 'qui', label: 'Quinta' },
  { id: 'sex', label: 'Sexta' },
  { id: 'sab', label: 'Sábado' },
  { id: 'dom', label: 'Domingo' },
]

export const Profissionais: React.FC = () => {
  const { organization } = useAuth()
  const orgId = organization?.id

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [profServices, setProfServices] = useState<ProfessionalService[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [defaultDuration, setDefaultDuration] = useState(45)
  const [workDays, setWorkDays] = useState<string[]>(['seg', 'ter', 'qua', 'qui', 'sex'])
  const [startHour, setStartHour] = useState('08:00')
  const [endHour, setEndHour] = useState('18:00')
  const [active, setActive] = useState(true)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [profsRes, servsRes, psRes] = await Promise.all([
        pb.collection('professionals').getFullList<Professional>({
          filter: `organization_id = "${orgId}"`,
          sort: 'name',
        }),
        pb.collection('services').getFullList<Service>({
          filter: `organization_id = "${orgId}"`,
          sort: 'name',
        }),
        pb.collection('professional_services').getFullList<ProfessionalService>({
          filter: `organization_id = "${orgId}"`,
        }),
      ])

      setProfessionals(profsRes)
      setServices(servsRes)
      setProfServices(psRes)
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
    setSpecialty('')
    setPhone('')
    setEmail('')
    setDefaultDuration(45)
    setWorkDays(['seg', 'ter', 'qua', 'qui', 'sex'])
    setStartHour('08:00')
    setEndHour('18:00')
    setActive(true)
    setSelectedServiceIds(services.map((s) => s.id))
    setModalOpen(true)
  }

  const openEditModal = (prof: Professional) => {
    setIsEditing(true)
    setEditId(prof.id)
    setName(prof.name)
    setSpecialty(prof.specialty || '')
    setPhone(prof.phone || '')
    setEmail(prof.email || '')
    setDefaultDuration(prof.default_duration || 45)
    setWorkDays(prof.work_days || ['seg', 'ter', 'qua', 'qui', 'sex'])
    setStartHour(prof.work_hours?.start || '08:00')
    setEndHour(prof.work_hours?.end || '18:00')
    setActive(prof.active !== false)

    const linkedServices = profServices
      .filter((ps) => ps.professional_id === prof.id)
      .map((ps) => ps.service_id)
    setSelectedServiceIds(linkedServices)

    setModalOpen(true)
  }

  const handleDayToggle = (dayId: string) => {
    setWorkDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId],
    )
  }

  const handleServiceToggle = (servId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(servId) ? prev.filter((s) => s !== servId) : [...prev, servId],
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !name.trim()) {
      toast.error('Informe o nome do profissional.')
      return
    }

    setSaving(true)
    try {
      const data = {
        organization_id: orgId,
        name: name.trim(),
        specialty: specialty.trim(),
        phone: phone.trim(),
        email: email.trim(),
        default_duration: defaultDuration,
        work_days: workDays,
        work_hours: { start: startHour, end: endHour },
        active: active,
      }

      let profIdSaved = editId

      if (isEditing && editId) {
        await pb.collection('professionals').update(editId, data)
        toast.success('Profissional atualizado com sucesso!')
      } else {
        const created = await pb.collection('professionals').create<Professional>(data)
        profIdSaved = created.id
        toast.success('Profissional cadastrado!')
      }

      // Sync professional_services junction
      if (profIdSaved) {
        // Delete old
        const existingLinks = profServices.filter((ps) => ps.professional_id === profIdSaved)
        for (const link of existingLinks) {
          if (!selectedServiceIds.includes(link.service_id)) {
            await pb.collection('professional_services').delete(link.id)
          }
        }
        // Add new
        for (const sId of selectedServiceIds) {
          const alreadyLinked = existingLinks.some((l) => l.service_id === sId)
          if (!alreadyLinked) {
            await pb.collection('professional_services').create({
              organization_id: orgId,
              professional_id: profIdSaved,
              service_id: sId,
            })
          }
        }
      }

      setModalOpen(false)
      await loadData()
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao salvar profissional.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente desativar/excluir este profissional?')) return
    try {
      await pb.collection('professionals').delete(id)
      toast.success('Profissional removido.')
      await loadData()
    } catch (err) {
      toast.error('Erro ao excluir profissional.')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-emerald-600" />
            Profissionais
          </h1>
          <p className="text-xs text-slate-500">
            Gerencie a equipe, horários de atendimento e serviços atribuídos a cada profissional.
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Novo Profissional
        </Button>
      </div>

      {/* PROFESSIONALS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {professionals.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200 p-8">
            <UserCheck className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Nenhum profissional cadastrado</p>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre profissionais para que eles tenham sua própria agenda individual.
            </p>
            <Button
              size="sm"
              onClick={openCreateModal}
              className="mt-4 bg-emerald-600 text-white text-xs"
            >
              Cadastrar Profissional
            </Button>
          </div>
        ) : (
          professionals.map((prof) => {
            const linkedServs = profServices
              .filter((ps) => ps.professional_id === prof.id)
              .map((ps) => services.find((s) => s.id === ps.service_id))
              .filter(Boolean) as Service[]

            return (
              <Card
                key={prof.id}
                className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                        {prof.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base text-slate-900">{prof.name}</CardTitle>
                        <CardDescription className="text-xs text-slate-500 font-medium">
                          {prof.specialty || 'Especialista'}
                        </CardDescription>
                      </div>
                    </div>

                    <Badge
                      variant={prof.active ? 'default' : 'secondary'}
                      className={
                        prof.active
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]'
                          : 'bg-slate-100 text-slate-500 text-[10px]'
                      }
                    >
                      {prof.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3 text-xs flex-1">
                  <div className="space-y-1.5 text-slate-600 border-t border-b border-slate-100 py-2">
                    {prof.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono">{prof.phone}</span>
                      </div>
                    )}
                    {prof.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{prof.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {prof.work_hours?.start || '08:00'} às {prof.work_hours?.end || '18:00'}{' '}
                        (padrão: {prof.default_duration || 45}m)
                      </span>
                    </div>
                  </div>

                  {/* Work Days Badges */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Dias de Atendimento:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {prof.work_days?.map((d) => (
                        <span
                          key={d}
                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium uppercase"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Services Provided */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Serviços ({linkedServs.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {linkedServs.length === 0 ? (
                        <span className="text-slate-400 text-[10px]">Nenhum serviço vinculado</span>
                      ) : (
                        linkedServs.map((s) => (
                          <span
                            key={s.id}
                            style={{ borderColor: s.color || '#cbd5e1' }}
                            className="px-1.5 py-0.5 rounded border bg-white text-slate-800 text-[10px] font-medium truncate max-w-[140px]"
                          >
                            {s.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(prof)}
                    className="text-xs h-7 px-2 text-slate-700 hover:bg-slate-200"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(prof.id)}
                    className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {isEditing ? 'Editar Profissional' : 'Novo Profissional'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Configure os dados e horários de trabalho do profissional.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Nome Completo *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Fernando..."
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Especialidade / Função
                  </Label>
                  <Input
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Ex: Biomédica, Dentista..."
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Telefone / WhatsApp
                  </Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98888-7777"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">E-mail</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="profissional@empresa.com"
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Working Hours & Duration */}
              <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Início Expediente</Label>
                  <Input
                    type="time"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Fim Expediente</Label>
                  <Input
                    type="time"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Duração Padrão (m)</Label>
                  <Input
                    type="number"
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(Number(e.target.value))}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Work Days Checkbox Group */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Dias Disponíveis para Atendimento
                </Label>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {ALL_DAYS.map((day) => (
                    <label
                      key={day.id}
                      className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                    >
                      <Checkbox
                        checked={workDays.includes(day.id)}
                        onCheckedChange={() => handleDayToggle(day.id)}
                      />
                      <span>{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Services Assignment */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Serviços que este profissional realiza
                </Label>
                <div className="grid grid-cols-2 gap-2 pt-1 max-h-36 overflow-y-auto border border-slate-200 p-2 rounded-lg">
                  {services.map((serv) => (
                    <label
                      key={serv.id}
                      className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedServiceIds.includes(serv.id)}
                        onCheckedChange={() => handleServiceToggle(serv.id)}
                      />
                      <span className="truncate">{serv.name}</span>
                    </label>
                  ))}
                </div>
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
                {saving
                  ? 'Salvando...'
                  : isEditing
                    ? 'Atualizar Profissional'
                    : 'Cadastrar Profissional'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Profissionais
