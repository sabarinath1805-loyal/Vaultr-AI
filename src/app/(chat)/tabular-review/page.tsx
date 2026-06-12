"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Table2, Plus, Search } from "lucide-react";
import { HeaderSearchBtn } from "@/components/shared/header-search-btn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface TabularReview {
  id: string;
  name: string;
  document_type?: string;
  columns: string[];
  document_ids: string[];
  created_at: string;
}

interface ReviewCardProps {
  review: TabularReview;
  onClick: () => void;
}

function ReviewCard({ review, onClick }: ReviewCardProps) {
  return (
    <Card
      key={review.id}
      className="cursor-pointer transition-colors hover:bg-[var(--hover)]"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{review.name}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          {review.document_type && (
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--text)]">
              {review.document_type}
            </span>
          )}
          <span className="text-[var(--text-muted)]">
            {review.columns.length} {review.columns.length === 1 ? "column" : "columns"} •
            {review.document_ids.length} {review.document_ids.length === 1 ? "doc" : "docs"}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--text-muted)]">
          Created {new Date(review.created_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}

export default function TabularReviewPage() {
  const [reviews, setReviews] = useState<TabularReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReviews = async () => {
    try {
      const response = await fetch("/api/tabular-review");
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error("[TabularReview] Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const createReview = async (data: {
    name: string;
    documentType?: string;
    columns: string[];
    documentIds: string[];
  }) => {
    try {
      const response = await fetch("/api/tabular-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        fetchReviews();
      }
    } catch (error) {
      console.error("[TabularReview] Failed to create review:", error);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const filteredReviews = reviews.filter((review) =>
    review.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-normal text-[var(--text)]" style={{ fontFamily: "var(--font-instrument-serif, 'Instrument Serif', serif)" }}>
            Tabular Review
          </h1>
          <p className="mt-2 text-sm leading-[1.6] text-[var(--text-muted)]">
            Extract data from documents into structured tables.
          </p>
        </div>
        <NewReviewDialog onCreate={createReview} />
      </div>

      {loading ? (
        <div className="mt-10 text-center text-[var(--text-muted)]">Loading reviews...</div>
      ) : filteredReviews.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredReviews.map((review) => (
            <Link href={`/tabular-review/${review.id}`} key={review.id}>
              <ReviewCard review={review} onClick={() => {}} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-16 flex flex-col items-center text-center">
          <Table2 className="mb-4 h-10 w-10 text-[var(--text-muted)]" strokeWidth={1.5} />
          <h3 className="text-xl font-medium text-[var(--text)]">No reviews yet</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Create your first tabular review to analyze multiple documents at once.
          </p>
          <div className="mt-6">
            <NewReviewDialog onCreate={createReview} />
          </div>
        </div>
      )}
    </main>
  );
}

function NewReviewDialog({ onCreate }: { onCreate: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [columns, setColumns] = useState<string[]>([""]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      name,
      documentType,
      columns: columns.filter((c) => c.trim() !== ""),
      documentIds,
    });
    setOpen(false);
    setName("");
    setDocumentType("");
    setColumns([""]);
    setDocumentIds([]);
  };

  const addColumn = () => {
    setColumns([...columns, ""]);
  };

  const updateColumn = (index: number, value: string) => {
    const newColumns = [...columns];
    newColumns[index] = value;
    setColumns(newColumns);
  };

  const removeColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const documentTypeOptions = [
    "NDA",
    "Employment Contract",
    "Service Agreement",
    "Lease",
    "Court Judgment",
    "Custom",
  ];

  const defaultColumns: Record<string, string[]> = {
    NDA: ["Governing Law", "Confidentiality Period", "Permitted Disclosures", "Return of Information", "Non-Solicitation", "Dispute Resolution", "Auto-Renewal"],
    "Employment Contract": ["Governing Law", "Notice Period", "Non-Compete", "IP Assignment", "Severance", "Probation Period", "Arbitration Clause"],
    "Service Agreement": ["Governing Law", "Liability Cap", "Indemnity", "Payment Terms", "Termination for Convenience", "Dispute Resolution", "SLA"],
    Lease: ["Governing Law", "Lease Term", "Rent Amount", "Rent Review", "Break Clause", "Deposit Amount", "Permitted Use"],
    "Court Judgment": ["Jurisdiction", "Court", "Date", "Outcome", "Key Legal Principle", "Damages Awarded", "Appeal Filed"],
  };

  const handleDocumentTypeChange = (value: string) => {
    setDocumentType(value);
    if (defaultColumns[value]) {
      setColumns(defaultColumns[value]);
    } else {
      setColumns([""]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span>New Review</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create New Review</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="name">Review name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NDAs Q1 2024"
              required
            />
          </div>
          <div>
            <Label htmlFor="documentType">Document type</Label>
            <Select value={documentType} onValueChange={handleDocumentTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="columns">Columns</Label>
            <div className="space-y-2">
              {columns.map((column, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={column}
                    onChange={(e) => updateColumn(index, e.target.value)}
                    placeholder={`Column ${index + 1}`}
                  />
                  {columns.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeColumn(index)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addColumn} className="w-full">
                + Add Column
              </Button>
            </div>
          </div>
          <Button type="submit" className="w-full">
            Create & Run
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
