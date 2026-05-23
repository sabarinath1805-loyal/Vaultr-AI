"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ContractAnalysis, ContractRisk } from "@/lib/contract-scanner";

interface ContractRiskReportPdfProps {
  analysis: ContractAnalysis;
  filename: string;
  reportDate: string;
}

const riskColors: Record<ContractRisk, { background: string; color: string }> = {
  CRITICAL: { background: "#fee2e2", color: "#7f1d1d" },
  HIGH: { background: "#fff0f0", color: "#a32d2d" },
  MEDIUM: { background: "#fffbf0", color: "#ba7517" },
  LOW: { background: "#f0fff4", color: "#276749" },
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#1a1916",
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 42,
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#e8e6e1",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 18,
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  mark: {
    backgroundColor: "#1a1916",
    borderRadius: 8,
    color: "#ffffff",
    fontSize: 16,
    height: 30,
    lineHeight: 1.7,
    textAlign: "center",
    width: 30,
  },
  title: {
    fontSize: 19,
  },
  meta: {
    color: "#8a8880",
    fontSize: 9,
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 700,
    paddingHorizontal: 10,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 18,
  },
  label: {
    color: "#8a8880",
    fontSize: 8,
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summary: {
    fontSize: 11,
    lineHeight: 1.55,
  },
  clause: {
    borderColor: "#e8e6e1",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  clauseHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  clauseTitle: {
    fontSize: 13,
    maxWidth: 360,
  },
  quote: {
    color: "#8a8880",
    fontSize: 9,
    fontStyle: "italic",
    lineHeight: 1.45,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  strong: {
    fontWeight: 700,
  },
  footer: {
    borderTopColor: "#e8e6e1",
    borderTopWidth: 1,
    bottom: 24,
    color: "#8a8880",
    fontSize: 8,
    left: 42,
    paddingTop: 8,
    position: "absolute",
    right: 42,
    textAlign: "center",
  },
});

function normalizeRisk(risk: ContractRisk | undefined): ContractRisk {
  return risk && riskColors[risk] ? risk : "LOW";
}

function RiskBadge({ risk }: { risk: ContractRisk }) {
  const colors = riskColors[risk];
  return (
    <Text style={[styles.badge, { backgroundColor: colors.background, color: colors.color }]}>
      {risk}
    </Text>
  );
}

export function ContractRiskReportPdf({
  analysis,
  filename,
  reportDate,
}: ContractRiskReportPdfProps) {
  const date = new Date(reportDate);
  const formattedDate = Number.isNaN(date.getTime())
    ? new Date().toLocaleDateString()
    : date.toLocaleDateString();
  const overallRisk = normalizeRisk(analysis.overall_risk);
  const clauses = Array.isArray(analysis.clauses) ? analysis.clauses : [];

  return (
    <Document title="Contract Risk Report">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.mark}>✳</Text>
            <View>
              <Text style={styles.title}>Contract Risk Report</Text>
              <Text style={styles.meta}>{filename} · {formattedDate}</Text>
            </View>
          </View>
          <RiskBadge risk={overallRisk} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Executive summary</Text>
          <Text style={styles.summary}>{analysis.summary || "No summary returned."}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Clauses</Text>
          {clauses.map((clause, index) => {
            const risk = normalizeRisk(clause.risk);
            return (
              <View key={`${clause.title}-${index}`} style={styles.clause} wrap={false}>
                <View style={styles.clauseHeader}>
                  <Text style={styles.clauseTitle}>{clause.title || "Clause"}</Text>
                  <RiskBadge risk={risk} />
                </View>
                {clause.excerpt ? <Text style={styles.quote}>“{clause.excerpt}”</Text> : null}
                <Text style={styles.paragraph}>
                  <Text style={styles.strong}>Issue: </Text>
                  {clause.issue || "No issue returned."}
                </Text>
                <Text style={styles.paragraph}>
                  <Text style={styles.strong}>Recommendation: </Text>
                  {clause.recommendation || "No recommendation returned."}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.footer}>Generated by Vaultr · {formattedDate}</Text>
      </Page>
    </Document>
  );
}
