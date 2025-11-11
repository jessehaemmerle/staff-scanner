import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { api } from '../App';
import { ScanBarcode, Plus, LogOut, FileDown, User as UserIcon, StickyNote } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function UserDashboard({ user, logout }) {
  const [employees, setEmployees] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [noteText, setNoteText] = useState('');
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [scanner, setScanner] = useState(null);
  const [activeTab, setActiveTab] = useState('scan');

  useEffect(() => {
    fetchEmployees();
    fetchNotes();
  }, []);

  useEffect(() => {
    if (isScanDialogOpen) {
      initScanner();
    }
    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, [isScanDialogOpen]);

  const initScanner = () => {
    const html5QrcodeScanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      false
    );

    html5QrcodeScanner.render(onScanSuccess, onScanError);
    setScanner(html5QrcodeScanner);
  };

  const onScanSuccess = (decodedText) => {
    setScannedBarcode(decodedText);
    toast.success('Barcode erfolgreich gescannt!');
    if (scanner) {
      scanner.clear();
    }
    setIsScanDialogOpen(false);
    checkEmployeeExists(decodedText);
  };

  const onScanError = (error) => {
    // Ignore scan errors
  };

  const checkEmployeeExists = async (barcode) => {
    try {
      const response = await api.get(`/employees/number/${barcode}`);
      setSelectedEmployee(response.data);
      setIsNoteDialogOpen(true);
    } catch (error) {
      if (error.response?.status === 404) {
        // Employee doesn't exist, show creation dialog
        toast.info('Mitarbeiter nicht gefunden. Bitte Namen eingeben.');
      }
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      toast.error('Fehler beim Laden der Mitarbeiter');
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await api.get('/notes');
      setNotes(response.data);
    } catch (error) {
      toast.error('Fehler beim Laden der Notizen');
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!scannedBarcode || !newEmployeeName) {
      toast.error('Bitte scannen Sie einen Barcode und geben Sie einen Namen ein');
      return;
    }

    try {
      const response = await api.post('/employees', {
        employee_number: scannedBarcode,
        name: newEmployeeName
      });
      toast.success('Mitarbeiter erfolgreich erstellt!');
      setSelectedEmployee(response.data);
      setNewEmployeeName('');
      setIsNoteDialogOpen(true);
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen des Mitarbeiters');
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !noteText) {
      toast.error('Bitte wählen Sie einen Mitarbeiter und geben Sie eine Notiz ein');
      return;
    }

    try {
      await api.post('/notes', {
        employee_id: selectedEmployee.id,
        note_text: noteText
      });
      toast.success('Notiz erfolgreich gespeichert!');
      setNoteText('');
      setIsNoteDialogOpen(false);
      setScannedBarcode('');
      setSelectedEmployee(null);
      fetchNotes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Speichern der Notiz');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/notes/export/csv', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `notizen_export_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export erfolgreich!');
    } catch (error) {
      toast.error('Fehler beim Exportieren');
    }
  };

  const getEmployeeById = (id) => {
    return employees.find(emp => emp.id === id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <ScanBarcode className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Mitarbeiter-Notizen</h1>
                <p className="text-sm text-slate-600">{user.email}</p>
              </div>
            </div>
            <Button
              onClick={logout}
              variant="outline"
              className="gap-2"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="scan" data-testid="scan-tab">Scannen</TabsTrigger>
            <TabsTrigger value="employees" data-testid="employees-tab">Mitarbeiter</TabsTrigger>
            <TabsTrigger value="notes" data-testid="notes-tab">Notizen</TabsTrigger>
          </TabsList>

          <TabsContent value="scan">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Barcode scannen</CardTitle>
                <CardDescription>Scannen Sie einen Mitarbeiterausweis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => setIsScanDialogOpen(true)}
                  className="w-full h-24 text-lg gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  data-testid="start-scan-button"
                >
                  <ScanBarcode className="w-8 h-8" />
                  Barcode scannen
                </Button>

                {scannedBarcode && !selectedEmployee && (
                  <form onSubmit={handleCreateEmployee} className="space-y-4 mt-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium">Gescannter Barcode:</p>
                      <p className="text-lg font-mono text-blue-600">{scannedBarcode}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeName">Mitarbeitername</Label>
                      <Input
                        id="employeeName"
                        placeholder="Max Mustermann"
                        value={newEmployeeName}
                        onChange={(e) => setNewEmployeeName(e.target.value)}
                        required
                        data-testid="employee-name-input"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                      data-testid="create-employee-button"
                    >
                      Mitarbeiter erstellen
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">Mitarbeiter ({employees.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((employee) => (
                <Card
                  key={employee.id}
                  className="shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedEmployee(employee);
                    setIsNoteDialogOpen(true);
                  }}
                  data-testid={`employee-card-${employee.id}`}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{employee.name}</CardTitle>
                        <CardDescription className="text-xs font-mono">{employee.employee_number}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
            {employees.length === 0 && (
              <Card className="shadow-md">
                <CardContent className="py-12 text-center">
                  <UserIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">Noch keine Mitarbeiter erfasst</p>
                  <Button
                    onClick={() => setActiveTab('scan')}
                    className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  >
                    <ScanBarcode className="w-4 h-4" />
                    Ersten Mitarbeiter scannen
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="notes">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">Notizen ({notes.length})</h2>
              <Button
                onClick={handleExport}
                variant="outline"
                className="gap-2"
                data-testid="export-csv-button"
              >
                <FileDown className="w-4 h-4" />
                CSV Export
              </Button>
            </div>
            <div className="space-y-4">
              {notes.map((note) => {
                const employee = getEmployeeById(note.employee_id);
                return (
                  <Card key={note.id} className="shadow-md" data-testid={`note-card-${note.id}`}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <StickyNote className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base">
                            {employee ? employee.name : 'Unbekannt'}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {employee ? `Nr. ${employee.employee_number}` : ''} • {new Date(note.timestamp).toLocaleString('de-DE')}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-700 whitespace-pre-wrap">{note.note_text}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {notes.length === 0 && (
              <Card className="shadow-md">
                <CardContent className="py-12 text-center">
                  <StickyNote className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">Noch keine Notizen erfasst</p>
                  <Button
                    onClick={() => setActiveTab('scan')}
                    className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  >
                    <Plus className="w-4 h-4" />
                    Erste Notiz erstellen
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Scan Dialog */}
      <Dialog open={isScanDialogOpen} onOpenChange={setIsScanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Barcode scannen</DialogTitle>
            <DialogDescription>
              Halten Sie den Barcode vor die Kamera
            </DialogDescription>
          </DialogHeader>
          <div id="qr-reader" className="w-full"></div>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notiz hinzufügen</DialogTitle>
            <DialogDescription>
              {selectedEmployee ? `Notiz für ${selectedEmployee.name}` : 'Mitarbeiter auswählen'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateNote} className="space-y-4">
            {selectedEmployee && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">{selectedEmployee.name}</p>
                <p className="text-xs text-blue-600 font-mono">Nr. {selectedEmployee.employee_number}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="note">Notiz</Label>
              <Textarea
                id="note"
                placeholder="Notiz eingeben..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                required
                rows={5}
                data-testid="note-text-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              data-testid="save-note-button"
            >
              Notiz speichern
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
