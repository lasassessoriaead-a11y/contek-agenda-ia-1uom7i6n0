import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { Professional, Service, ProfessionalService, WorkShift } from '@/types'
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
  Coffee,
  CalendarOff,
  X,
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
  const [lunchStart, setLunchStart] = useState('')
  const [lunchEnd, setLunchEnd] = useState('')
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([
    { start: '08:00', end: '12:00' },
    { start: '14:00', end: '18:00' },
  ])
  const [dateExceptions, setDateExceptions] = useState<string[]>([])
  const [newExceptionDate, setNewExceptionDate] = useState('')
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

  // Robust parser for JSON or byte-array lists from PocketBase
  const parseListField = <T,>(val: unknown): T[] => {
    if (!val) return []
    if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === 'number') {
        try {
          const str = String.fromCharCode(...(val as number[]))
          const parsed = JSON.parse(str)
          return Array.isArray(parsed) ? (parsed as T[]) : []
        } catch {
          return []
        }
      }
      return val as T[]
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        return Array.isArray(parsed) ? (parsed as T[]) : []
      } catch {
        return []
      }
    }
    return []
  }

  const parseObjField = <T extends object>(val: unknown): T | null => {
    if (!val) return null
    if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === 'number') {
        try {
          const str = String.fromCharCode(...(val as number[]))
          const parsed = JSON.parse(str)
          return typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null
        } catch {
          return null
        }
      }
      return null
    }
    if (typeof val === 'object' && !Array.isArray(val)) return val as T
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        return typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null
      } catch {
        return null
      }
    }
    return null
  }

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
    setLunchStart('')
    setLunchEnd('')
    setWorkShifts([
      { start: '08:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ])
    setDateExceptions([])
    setNewExceptionDate('')
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

    const parsedHours = parseObjField<{
      start?: string
      end?: string
      lunch_start?: string
      lunch_end?: string
    }>(prof.work_hours)

    const parsedShifts = parseListField<WorkShift>(prof.work_shifts)

    setStartHour(parsedHours?.start || '08:00')
    setEndHour(parsedHours?.end || '18:00')
    setLunchStart(parsedHours?.lunch_start || '')
    setLunchEnd(parsedHours?.lunch_end || '')

    if (parsedShifts && parsedShifts.length > 0) {
      setWorkShifts(parsedShifts)
    } else if (parsedHours?.start && parsedHours?.end) {
      if (parsedHours.lunch_start && parsedHours.lunch_end) {
        setWorkShifts([
          { start: parsedHours.start, end: parsedHours.lunch_start },
          { start: parsedHours.lunch_end, end: parsedHours.end },
        ])
      } else {
        setWorkShifts([{ start: parsedHours.start, end: parsedHours.end }])
      }
    } else {
      setWorkShifts([
        { start: '08:00', end: '12:00' },
        { start: '14:00', end: '18:00' },
      ])
    }

    const parsedExceptions = parseListField<string>(prof.date_exceptions)
    setDateExceptions(parsedExceptions || [])
    setNewExceptionDate('')

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

  const handleAddShift = () => {
    setWorkShifts((prev) => [...prev, { start: '19:00', end: '22:00' }])
  }

  const handleRemoveShift = (index: number) => {
    setWorkShifts((prev) => prev.filter((_, i) => i !== index))
  }

  const handleShiftChange = (index: number, field: 'start' | 'end', value: string) => {
    setWorkShifts((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleAddExceptionDate = () => {
    if (!newExceptionDate) return
    const clean = newExceptionDate.slice(0, 10)
    if (dateExceptions.includes(clean)) {
      toast.error('Esta data já foi incluída nas exceções.')
      return
    }
    setDateExceptions((prev) => [...prev, clean].sort())
    setNewExceptionDate('')
    toast.success('Data de folga/exceção adicionada!')
  }

  const handleRemoveExceptionDate = (dateToRemove: string) => {
    setDateExceptions((prev) => prev.filter((d) => d !== dateToRemove))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !name.trim()) {
      toast.error('Informe o nome do profissional.')
      return
    }

    // Validate shifts
    if (workShifts.length === 0) {
      toast.error('Adicione pelo menos um turno de trabalho para o profissional.')
      return
    }

    for (let i = 0; i < workShifts.length; i++) {
      const shift = workShifts[i]
      if (!shift.start || !shift.end) {
        toast.error(`Preencha o início e fim do turno ${i + 1}.`)
        return
      }
      if (shift.end <= shift.start) {
        toast.error(
          `O término do turno ${i + 1} (${shift.end}) deve ser maior que o início (${shift.start}).`,
        )
        return
      }
    }

    // Sort shifts by start time
    const sortedShifts = [...workShifts].sort((a, b) => a.start.localeCompare(b.start))

    // Determine primary start and end for backward compatibility
    const overallStart = sortedShifts[0].start
    const overallEnd = sortedShifts[sortedShifts.length - 1].end

    setSaving(true)
    try {
      const workHoursData: {
        start: string
        end: string
        lunch_start?: string
        lunch_end?: string
      } = {
        start: overallStart,
        end: overallEnd,
      }

      if (lunchStart && lunchEnd) {
        workHoursData.lunch_start = lunchStart
        workHoursData.lunch_end = lunchEnd
      }

      const data = {
        organization_id: orgId,
        name: name.trim(),
        specialty: specialty.trim(),
        phone: phone.trim(),
        email: email.trim(),
        default_duration: defaultDuration,
        work_days: workDays,
        work_shifts: sortedShifts,
        work_hours: workHoursData,
        date_exceptions: dateExceptions,
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
                    <div className="flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        {(() => {
                          const shifts = parseListField<WorkShift>(prof.work_shifts)
                          if (shifts && shifts.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-1">
                                {shifts.map((s, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-medium"
                                  >
                                    {s.start} - {s.end}
                                  </span>
                                ))}
                                <span className="text-[10px] text-slate-400 ml-1">
                                  ({prof.default_duration || 45}m)
                                </span>
                              </div>
                            )
                          }
                          const parsedHours = parseObjField<{
                            start?: string
                            end?: string
                            lunch_start?: string
                            lunch_end?: string
                          }>(prof.work_hours)
                          return (
                            <span>
                              {parsedHours?.start || '08:00'} às {parsedHours?.end || '18:00'}
                              {parsedHours?.lunch_start && parsedHours?.lunch_end && (
                                <span className="text-slate-400 text-[10px] ml-1">
                                  (int: {parsedHours.lunch_start}-{parsedHours.lunch_end})
                                </span>
                              )}{' '}
                              (padrão: {prof.default_duration || 45}m)
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Work Days Badges */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Dias de Atendimento e Folgas:
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

                    {/* Exceções / Folgas cadastradas */}
                    {(() => {
                      const exceptions = parseListField<string>(prof.date_exceptions)
                      if (!exceptions || exceptions.length === 0) return null
                      return (
                        <div className="mt-2 pt-1.5 border-t border-slate-100">
                          <span className="text-[10px] font-semibold text-rose-700 flex items-center gap-1 mb-1">
                            <CalendarOff className="w-3 h-3 text-rose-500" />
                            Folgas / Exceções ({exceptions.length}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {exceptions.map((dt) => {
                              const clean = typeof dt === 'string' ? dt.slice(0, 10) : ''
                              const parts = clean.split('-')
                              const formatted =
                                parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : clean
                              return (
                                <span
                                  key={clean}
                                  className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-medium"
                                >
                                  {formatted}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
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

              {/* Turnos de Trabalho (Múltiplos Turnos) */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      Turnos de Atendimento (Expediente)
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      Configure os períodos em que o profissional atende (ex: 08:00–12:00 e
                      14:00–16:00).
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddShift}
                    className="h-7 text-xs bg-white text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar turno
                  </Button>
                </div>

                <div className="space-y-2">
                  {workShifts.map((shift, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-white p-2 rounded-md border border-slate-200 shadow-2xs"
                    >
                      <span className="text-[11px] font-semibold text-slate-500 w-16 shrink-0">
                        Turno {idx + 1}:
                      </span>
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          type="time"
                          value={shift.start}
                          onChange={(e) => handleShiftChange(idx, 'start', e.target.value)}
                          className="text-xs h-8"
                          required
                        />
                        <span className="text-slate-400 text-xs">até</span>
                        <Input
                          type="time"
                          value={shift.end}
                          onChange={(e) => handleShiftChange(idx, 'end', e.target.value)}
                          className="text-xs h-8"
                          required
                        />
                      </div>
                      {workShifts.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveShift(idx)}
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 shrink-0"
                          title="Remover turno"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Duração Padrão e Intervalo Opcional */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">
                      Duração Padrão (m)
                    </Label>
                    <Input
                      type="number"
                      value={defaultDuration}
                      onChange={(e) => setDefaultDuration(Number(e.target.value))}
                      className="text-xs h-8 bg-white"
                      min={5}
                      step={5}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <Coffee className="w-3 h-3 text-amber-600" />
                      Pausa/Almoço Início
                    </Label>
                    <Input
                      type="time"
                      value={lunchStart}
                      onChange={(e) => setLunchStart(e.target.value)}
                      placeholder="Opcional"
                      className="text-xs h-8 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <Coffee className="w-3 h-3 text-amber-600" />
                      Pausa/Almoço Fim
                    </Label>
                    <Input
                      type="time"
                      value={lunchEnd}
                      onChange={(e) => setLunchEnd(e.target.value)}
                      placeholder="Opcional"
                      className="text-xs h-8 bg-white"
                    />
                  </div>
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

              {/* Datas de Exceção / Folgas pontuais */}
              <div className="bg-rose-50/60 p-3 rounded-lg border border-rose-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CalendarOff className="w-4 h-4 text-rose-600" />
                    <div>
                      <Label className="text-xs font-semibold text-rose-950">
                        Datas de Exceção / Folgas Pontuais
                      </Label>
                      <p className="text-[11px] text-rose-700">
                        Marque dias específicos em que o profissional NÃO atenderá (folgas, feriados
                        ou férias).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={newExceptionDate}
                    onChange={(e) => setNewExceptionDate(e.target.value)}
                    className="text-xs h-8 bg-white border-rose-200 focus-visible:ring-rose-400"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddExceptionDate}
                    disabled={!newExceptionDate}
                    className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white shrink-0 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Bloquear Data
                  </Button>
                </div>

                {dateExceptions.length > 0 ? (
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-medium text-rose-900 block">
                      Datas bloqueadas para este profissional ({dateExceptions.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                      {dateExceptions.map((dt) => {
                        const parts = dt.split('-')
                        const formatted =
                          parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dt
                        return (
                          <span
                            key={dt}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-rose-300 text-rose-800 text-xs shadow-2xs"
                          >
                            <span>{formatted}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExceptionDate(dt)}
                              className="text-rose-400 hover:text-rose-700 rounded-full p-0.5"
                              title="Remover exceção"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-rose-600/80 italic">
                    Nenhuma data de folga pontual adicionada. O profissional seguirá os dias
                    regulares da semana.
                  </p>
                )}
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
