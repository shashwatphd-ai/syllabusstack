import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  MoreVertical,
  Mail,
  Award,
  Download,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type GradebookEntry,
  type CourseAssessment,
  useFilteredGradebook,
  useExportGradebook,
} from '@/hooks/useGradebook';

interface GradebookTableProps {
  courseId: string;
  assessments: CourseAssessment[];
  onSendMessage: (studentIds: string[]) => void;
  onIssueCertificate: (studentId: string) => void;
  onViewStudent: (studentId: string) => void;
}

type FilterType = 'all' | 'passing' | 'failing' | 'completed' | 'not_started';
type SortField = 'name' | 'progress' | 'score' | 'enrolled' | 'activity';

const statusConfig: Record<GradebookEntry['status'], {
  label: string;
  icon: typeof CheckCircle2;
  className: string;
}> = {
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  passing: {
    label: 'Passing',
    icon: CheckCircle2,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  failing: {
    label: 'At Risk',
    icon: AlertTriangle,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  },
  not_started: {
    label: 'Not Started',
    icon: Ban,
    className: 'bg-gray-50 text-gray-500 border-gray-200',
  },
};

const gradeColors: Record<string, string> = {
  A: 'text-green-600 bg-green-50',
  B: 'text-blue-600 bg-blue-50',
  C: 'text-amber-600 bg-amber-50',
  D: 'text-orange-600 bg-orange-50',
  F: 'text-red-600 bg-red-50',
};

export function GradebookTable({
  courseId,
  assessments,
  onSendMessage,
  onIssueCertificate,
  onViewStudent,
}: GradebookTableProps) {
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { entries, isLoading, totalCount, filteredCount } = useFilteredGradebook(courseId, {
    filter,
    sortBy,
    sortOrder,
    searchQuery,
  });

  const { exportToCsv, isReady: canExport } = useExportGradebook(courseId);

  const toggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const toggleAllStudents = () => {
    if (selectedStudents.size === entries.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(entries.map(e => e.studentId)));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleBulkMessage = () => {
    onSendMessage(Array.from(selectedStudents));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter */}
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            <SelectItem value="passing">Passing</SelectItem>
            <SelectItem value="failing">At Risk</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
          </SelectContent>
        </Select>

        {/* Bulk Actions */}
        {selectedStudents.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              {selectedStudents.size} selected
            </Badge>
            <Button variant="outline" size="sm" onClick={handleBulkMessage}>
              <Mail className="h-4 w-4 mr-2" />
              Message
            </Button>
          </div>
        )}

        {/* Export */}
        <Button variant="outline" size="sm" onClick={exportToCsv} disabled={!canExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Results count */}
      {searchQuery || filter !== 'all' ? (
        <p className="text-sm text-muted-foreground">
          Showing {filteredCount} of {totalCount} students
        </p>
      ) : null}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedStudents.size === entries.length && entries.length > 0}
                  onCheckedChange={toggleAllStudents}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 font-semibold"
                  onClick={() => handleSort('name')}
                >
                  Student
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 font-semibold"
                  onClick={() => handleSort('progress')}
                >
                  Progress
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              {assessments.slice(0, 3).map((assessment) => (
                <TableHead key={assessment.id} className="text-center">
                  <span className="text-xs truncate max-w-[100px] block" title={assessment.title}>
                    {assessment.title}
                  </span>
                </TableHead>
              ))}
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 font-semibold"
                  onClick={() => handleSort('score')}
                >
                  Avg Score
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7 + Math.min(assessments.length, 3)} className="text-center py-8">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {searchQuery || filter !== 'all'
                      ? 'No students match your filters'
                      : 'No students enrolled yet'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <GradebookRow
                  key={entry.id}
                  entry={entry}
                  assessments={assessments}
                  isSelected={selectedStudents.has(entry.studentId)}
                  onToggleSelect={() => toggleStudent(entry.studentId)}
                  onSendMessage={() => onSendMessage([entry.studentId])}
                  onIssueCertificate={() => onIssueCertificate(entry.studentId)}
                  onViewStudent={() => onViewStudent(entry.studentId)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GradebookRow({
  entry,
  assessments,
  isSelected,
  onToggleSelect,
  onSendMessage,
  onIssueCertificate,
  onViewStudent,
}: {
  entry: GradebookEntry;
  assessments: CourseAssessment[];
  isSelected: boolean;
  onToggleSelect: () => void;
  onSendMessage: () => void;
  onIssueCertificate: () => void;
  onViewStudent: () => void;
}) {
  const status = statusConfig[entry.status];
  const StatusIcon = status.icon;

  return (
    <TableRow className={cn(isSelected && 'bg-muted/50')}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          aria-label={`Select ${entry.studentName}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{entry.studentName}</span>
          <span className="text-xs text-muted-foreground">{entry.studentEmail}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 min-w-[100px]">
          <Progress value={entry.overallProgress} className="h-2 w-16" />
          <span className="text-sm text-muted-foreground">{entry.overallProgress}%</span>
        </div>
      </TableCell>
      {assessments.slice(0, 3).map((assessment) => {
        const grade = entry.assessments.find(a => a.assessmentId === assessment.id);
        return (
          <TableCell key={assessment.id} className="text-center">
            {grade?.score !== null && grade?.score !== undefined ? (
              <span className={cn(
                'text-sm font-medium',
                grade.score >= 70 ? 'text-green-600' : 'text-red-600'
              )}>
                {grade.score}%
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">-</span>
            )}
          </TableCell>
        );
      })}
      <TableCell>
        {entry.averageScore !== null ? (
          <span className="font-medium">{entry.averageScore}%</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {entry.letterGrade ? (
          <span className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm',
            gradeColors[entry.letterGrade]
          )}>
            {entry.letterGrade}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('gap-1', status.className)}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onViewStudent}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSendMessage}>
              <Mail className="h-4 w-4 mr-2" />
              Send Message
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onIssueCertificate}
              disabled={entry.status === 'completed'}
            >
              <Award className="h-4 w-4 mr-2" />
              Issue Certificate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
