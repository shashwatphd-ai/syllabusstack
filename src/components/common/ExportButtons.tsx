import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileJson, FileText, Loader2 } from 'lucide-react';
import { fetchExportData, exportAsJSON, exportAsPDF } from '@/lib/export-utils';
import { useToast } from '@/hooks/use-toast';

interface ExportButtonsProps {
  variant?: 'dropdown' | 'inline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ExportButtons({ variant = 'dropdown', size = 'sm' }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'json' | null>(null);
  const { toast } = useToast();

  const handleExport = async (type: 'pdf' | 'json') => {
    setIsExporting(true);
    setExportType(type);
    
    try {
      const data = await fetchExportData();
      
      if (type === 'pdf') {
        exportAsPDF(data);
        toast({
          title: 'PDF Export Ready',
          description: 'Use the print dialog to save as PDF.',
        });
      } else {
        exportAsJSON(data);
        toast({
          title: 'Export Complete',
          description: 'Your data has been downloaded as JSON.',
        });
      }
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size={size}
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
        >
          {isExporting && exportType === 'pdf' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Export PDF
        </Button>
        <Button
          variant="outline"
          size={size}
          onClick={() => handleExport('json')}
          disabled={isExporting}
        >
          {isExporting && exportType === 'json' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileJson className="h-4 w-4 mr-2" />
          )}
          Export JSON
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
