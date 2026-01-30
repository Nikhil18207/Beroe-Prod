"""
Unified Data Ingestion Service
Handles ingestion of all 4 data sources:
1. Overall Spend Data (CSV/XLSX)
2. Supply Master (CSV/XLSX)
3. Contracts (CSV/XLSX/PDF)
4. Category Playbook (CSV/Markdown/PDF)
"""

import os
import csv
import json
import logging
from datetime import datetime, date
from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID
from io import StringIO
import re

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.computed_data import (
    ComputedMetric,
    SupplierProfile,
    ContractSummary,
    PlaybookRule,
    DataCrossReference
)

logger = logging.getLogger(__name__)


class DataSourceType:
    """Enum-like class for data source types."""
    SPEND = "overall_spend"
    SUPPLIER = "supply_master"
    CONTRACT = "contracts"
    PLAYBOOK = "category_playbook"


class DataIngestionResult:
    """Result of a data ingestion operation."""
    
    def __init__(
        self,
        source_type: str,
        success: bool,
        records_processed: int = 0,
        errors: List[str] = None,
        warnings: List[str] = None,
        metadata: Dict = None
    ):
        self.source_type = source_type
        self.success = success
        self.records_processed = records_processed
        self.errors = errors or []
        self.warnings = warnings or []
        self.metadata = metadata or {}
        self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict:
        return {
            "source_type": self.source_type,
            "success": self.success,
            "records_processed": self.records_processed,
            "errors": self.errors,
            "warnings": self.warnings,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat()
        }


class DataIngestionService:
    """
    Unified service for ingesting all procurement data sources.
    Parses files, validates structure, and triggers compute layer.
    """
    
    # Expected columns for each data source
    SPEND_COLUMNS = {
        "required": ["supplier_name", "amount"],
        "optional": ["category", "subcategory", "region", "date", "po_number", "invoice_number"]
    }
    
    SUPPLIER_COLUMNS = {
        "required": ["supplier_id", "supplier_name"],
        "optional": ["country", "region", "city", "quality_rating", "delivery_rating", 
                    "certifications", "is_diverse", "sustainability_score"]
    }
    
    CONTRACT_COLUMNS = {
        "required": ["supplier_id", "supplier_name"],
        "optional": ["contract_id", "contract_type", "start_date", "expiry_date",
                    "annual_value", "payment_terms", "price_escalation_cap"]
    }
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    # ========================
    # SPEND DATA INGESTION
    # ========================
    
    async def ingest_spend_data(
        self,
        session_id: UUID,
        file_path: str = None,
        file_content: str = None,
        file_type: str = "csv"
    ) -> DataIngestionResult:
        """
        Ingest overall spend data from CSV/XLSX.
        Extracts: supplier names, amounts, categories, regions.
        """
        logger.info(f"Ingesting spend data for session {session_id}")
        
        try:
            # Load data
            df = self._load_file(file_path, file_content, file_type)
            
            # Normalize column names
            df = self._normalize_columns(df)
            
            # Validate required columns
            validation = self._validate_columns(df, self.SPEND_COLUMNS)
            if not validation["valid"]:
                return DataIngestionResult(
                    source_type=DataSourceType.SPEND,
                    success=False,
                    errors=validation["errors"]
                )
            
            # Process spend data
            processed = await self._process_spend_data(session_id, df)
            
            return DataIngestionResult(
                source_type=DataSourceType.SPEND,
                success=True,
                records_processed=processed["count"],
                warnings=validation.get("warnings", []),
                metadata={
                    "total_spend": processed["total_spend"],
                    "unique_suppliers": processed["unique_suppliers"],
                    "categories": processed["categories"]
                }
            )
            
        except Exception as e:
            logger.error(f"Error ingesting spend data: {e}")
            return DataIngestionResult(
                source_type=DataSourceType.SPEND,
                success=False,
                errors=[str(e)]
            )
    
    async def _process_spend_data(
        self,
        session_id: UUID,
        df: pd.DataFrame
    ) -> Dict:
        """Process spend dataframe and compute metrics."""
        
        # Ensure amount column is numeric
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
        
        # Basic aggregations
        total_spend = df["amount"].sum()
        
        # Supplier aggregation
        supplier_spend = df.groupby("supplier_name")["amount"].sum().reset_index()
        supplier_spend["percentage"] = (supplier_spend["amount"] / total_spend * 100).round(2)
        supplier_spend = supplier_spend.sort_values("amount", ascending=False)
        
        unique_suppliers = len(supplier_spend)
        
        # Calculate HHI (Herfindahl-Hirschman Index)
        hhi = (supplier_spend["percentage"] ** 2).sum()
        
        # Category analysis if available
        categories = []
        if "category" in df.columns:
            category_spend = df.groupby("category")["amount"].sum().reset_index()
            categories = category_spend["category"].tolist()
        
        # Top supplier concentration
        top_3_pct = supplier_spend.head(3)["percentage"].sum() if len(supplier_spend) >= 3 else 100
        top_5_pct = supplier_spend.head(5)["percentage"].sum() if len(supplier_spend) >= 5 else 100
        top_10_pct = supplier_spend.head(10)["percentage"].sum() if len(supplier_spend) >= 10 else 100
        
        # Regional concentration if available
        regional_metrics = {}
        if "region" in df.columns:
            region_spend = df.groupby("region")["amount"].sum().reset_index()
            region_spend["percentage"] = (region_spend["amount"] / total_spend * 100).round(2)
            top_region = region_spend.iloc[0] if len(region_spend) > 0 else None
            if top_region is not None:
                regional_metrics["top_region"] = top_region["region"]
                regional_metrics["top_region_pct"] = float(top_region["percentage"])
        
        # Store computed metrics
        metrics_to_store = [
            ("total_spend", total_spend, "USD"),
            ("unique_suppliers", unique_suppliers, "count"),
            ("hhi_index", hhi, "index"),
            ("top_3_concentration", top_3_pct, "percentage"),
            ("top_5_concentration", top_5_pct, "percentage"),
            ("top_10_concentration", top_10_pct, "percentage"),
        ]
        
        if regional_metrics:
            metrics_to_store.append(
                ("regional_concentration", regional_metrics.get("top_region_pct", 0), "percentage")
            )
        
        # Clear existing metrics for this session
        await self.session.execute(
            delete(ComputedMetric).where(
                ComputedMetric.session_id == session_id,
                ComputedMetric.data_sources == "spend_data"
            )
        )
        
        # Insert new metrics
        for metric_name, value, unit in metrics_to_store:
            metric = ComputedMetric(
                session_id=session_id,
                category="ALL",  # Will be category-specific when category provided
                metric_name=metric_name,
                metric_value=float(value),
                metric_unit=unit,
                calculation_method="spend_aggregation",
                data_sources="spend_data",
                confidence_level="HIGH"
            )
            self.session.add(metric)
        
        await self.session.commit()
        
        return {
            "count": len(df),
            "total_spend": float(total_spend),
            "unique_suppliers": unique_suppliers,
            "categories": categories
        }
    
    # ========================
    # SUPPLIER DATA INGESTION
    # ========================
    
    async def ingest_supplier_data(
        self,
        session_id: UUID,
        file_path: str = None,
        file_content: str = None,
        file_type: str = "csv"
    ) -> DataIngestionResult:
        """
        Ingest supply master data.
        Extracts: supplier profiles, ratings, certifications, locations.
        """
        logger.info(f"Ingesting supplier data for session {session_id}")
        
        try:
            df = self._load_file(file_path, file_content, file_type)
            df = self._normalize_columns(df)
            
            validation = self._validate_columns(df, self.SUPPLIER_COLUMNS)
            if not validation["valid"]:
                return DataIngestionResult(
                    source_type=DataSourceType.SUPPLIER,
                    success=False,
                    errors=validation["errors"]
                )
            
            processed = await self._process_supplier_data(session_id, df)
            
            return DataIngestionResult(
                source_type=DataSourceType.SUPPLIER,
                success=True,
                records_processed=processed["count"],
                warnings=validation.get("warnings", []),
                metadata={
                    "total_suppliers": processed["count"],
                    "avg_quality_rating": processed.get("avg_quality"),
                    "diverse_suppliers": processed.get("diverse_count")
                }
            )
            
        except Exception as e:
            logger.error(f"Error ingesting supplier data: {e}")
            return DataIngestionResult(
                source_type=DataSourceType.SUPPLIER,
                success=False,
                errors=[str(e)]
            )
    
    async def _process_supplier_data(
        self,
        session_id: UUID,
        df: pd.DataFrame
    ) -> Dict:
        """Process supplier dataframe and create profiles."""
        
        # Clear existing profiles
        await self.session.execute(
            delete(SupplierProfile).where(SupplierProfile.session_id == session_id)
        )
        
        count = 0
        total_quality = 0
        diverse_count = 0
        
        for _, row in df.iterrows():
            profile = SupplierProfile(
                session_id=session_id,
                supplier_id=str(row.get("supplier_id", "")),
                supplier_name=str(row.get("supplier_name", "")),
                country=str(row.get("country", "")) if pd.notna(row.get("country")) else None,
                region=str(row.get("region", "")) if pd.notna(row.get("region")) else None,
                city=str(row.get("city", "")) if pd.notna(row.get("city")) else None,
                quality_rating=self._safe_float(row.get("quality_rating")),
                delivery_rating=self._safe_float(row.get("delivery_rating")),
                responsiveness_rating=self._safe_float(row.get("responsiveness_rating")),
                certifications=str(row.get("certifications", "")) if pd.notna(row.get("certifications")) else None,
                sustainability_score=self._safe_float(row.get("sustainability_score")),
                is_diverse_supplier=self._safe_bool(row.get("is_diverse", False))
            )
            
            # Compute initial risk score (simple version)
            profile.overall_risk_score = self._compute_supplier_risk(profile)
            
            self.session.add(profile)
            count += 1
            
            if profile.quality_rating:
                total_quality += profile.quality_rating
            if profile.is_diverse_supplier:
                diverse_count += 1
        
        await self.session.commit()
        
        return {
            "count": count,
            "avg_quality": round(total_quality / count, 2) if count > 0 else None,
            "diverse_count": diverse_count
        }
    
    def _compute_supplier_risk(self, profile: SupplierProfile) -> float:
        """Compute simple risk score for supplier (0-100, higher = more risk)."""
        risk_score = 50  # Default baseline
        
        # Quality rating impact (lower quality = higher risk)
        if profile.quality_rating:
            risk_score -= (profile.quality_rating - 3) * 10  # 5-star = -20, 1-star = +20
        
        # Certifications impact
        if profile.certifications:
            cert_count = len(profile.certifications.split(","))
            risk_score -= min(cert_count * 5, 15)  # Max -15 for certs
        else:
            risk_score += 10  # No certs = higher risk
        
        # Sustainability impact
        if profile.sustainability_score:
            if profile.sustainability_score > 80:
                risk_score -= 10
            elif profile.sustainability_score < 40:
                risk_score += 10
        
        return max(0, min(100, risk_score))
    
    # ========================
    # CONTRACT DATA INGESTION
    # ========================
    
    async def ingest_contract_data(
        self,
        session_id: UUID,
        file_path: str = None,
        file_content: str = None,
        file_type: str = "csv"
    ) -> DataIngestionResult:
        """
        Ingest contract data.
        Extracts: contract terms, expiry dates, payment terms, escalation caps.
        """
        logger.info(f"Ingesting contract data for session {session_id}")
        
        try:
            df = self._load_file(file_path, file_content, file_type)
            df = self._normalize_columns(df)
            
            validation = self._validate_columns(df, self.CONTRACT_COLUMNS)
            if not validation["valid"]:
                return DataIngestionResult(
                    source_type=DataSourceType.CONTRACT,
                    success=False,
                    errors=validation["errors"]
                )
            
            processed = await self._process_contract_data(session_id, df)
            
            return DataIngestionResult(
                source_type=DataSourceType.CONTRACT,
                success=True,
                records_processed=processed["count"],
                warnings=validation.get("warnings", []),
                metadata={
                    "total_contracts": processed["count"],
                    "expiring_soon": processed.get("expiring_soon"),
                    "total_value": processed.get("total_value")
                }
            )
            
        except Exception as e:
            logger.error(f"Error ingesting contract data: {e}")
            return DataIngestionResult(
                source_type=DataSourceType.CONTRACT,
                success=False,
                errors=[str(e)]
            )
    
    async def _process_contract_data(
        self,
        session_id: UUID,
        df: pd.DataFrame
    ) -> Dict:
        """Process contract dataframe and create summaries."""
        
        # Clear existing contracts
        await self.session.execute(
            delete(ContractSummary).where(ContractSummary.session_id == session_id)
        )
        
        count = 0
        expiring_soon = 0
        total_value = 0
        today = date.today()
        
        for _, row in df.iterrows():
            expiry = self._parse_date(row.get("expiry_date"))
            days_to_expiry = (expiry - today).days if expiry else None
            
            contract = ContractSummary(
                session_id=session_id,
                contract_id=str(row.get("contract_id", "")) if pd.notna(row.get("contract_id")) else None,
                supplier_id=str(row.get("supplier_id", "")),
                supplier_name=str(row.get("supplier_name", "")) if pd.notna(row.get("supplier_name")) else None,
                contract_type=str(row.get("contract_type", "")) if pd.notna(row.get("contract_type")) else None,
                payment_terms=str(row.get("payment_terms", "")) if pd.notna(row.get("payment_terms")) else None,
                start_date=self._parse_date(row.get("start_date")),
                expiry_date=expiry,
                days_to_expiry=days_to_expiry,
                annual_value=self._safe_float(row.get("annual_value")),
                total_contract_value=self._safe_float(row.get("total_value")),
                has_price_escalation=pd.notna(row.get("price_escalation_cap")),
                price_escalation_cap=self._safe_float(row.get("price_escalation_cap")),
                status=self._determine_contract_status(days_to_expiry)
            )
            
            self.session.add(contract)
            count += 1
            
            if days_to_expiry and 0 < days_to_expiry <= 90:
                expiring_soon += 1
            
            if contract.annual_value:
                total_value += contract.annual_value
        
        await self.session.commit()
        
        # Store contract-derived metrics
        metrics = [
            ("contracts_expiring_90_days", expiring_soon, "count"),
            ("total_contract_value", total_value, "USD"),
            ("active_contracts", count, "count"),
        ]
        
        for metric_name, value, unit in metrics:
            metric = ComputedMetric(
                session_id=session_id,
                category="ALL",
                metric_name=metric_name,
                metric_value=float(value),
                metric_unit=unit,
                calculation_method="contract_analysis",
                data_sources="contracts",
                confidence_level="HIGH"
            )
            self.session.add(metric)
        
        await self.session.commit()
        
        return {
            "count": count,
            "expiring_soon": expiring_soon,
            "total_value": total_value
        }
    
    def _determine_contract_status(self, days_to_expiry: Optional[int]) -> str:
        """Determine contract status based on expiry."""
        if days_to_expiry is None:
            return "active"
        if days_to_expiry < 0:
            return "expired"
        if days_to_expiry <= 30:
            return "expiring"
        return "active"
    
    # ========================
    # PLAYBOOK DATA INGESTION
    # ========================
    
    async def ingest_playbook_data(
        self,
        session_id: UUID,
        file_path: str = None,
        file_content: str = None,
        file_type: str = "csv"
    ) -> DataIngestionResult:
        """
        Ingest category playbook rules.
        Extracts: thresholds, benchmarks, risk rules, best practices.
        """
        logger.info(f"Ingesting playbook data for session {session_id}")
        
        try:
            if file_type == "csv":
                rules = await self._parse_playbook_csv(session_id, file_path, file_content)
            elif file_type in ["md", "markdown"]:
                rules = await self._parse_playbook_markdown(session_id, file_path, file_content)
            else:
                return DataIngestionResult(
                    source_type=DataSourceType.PLAYBOOK,
                    success=False,
                    errors=[f"Unsupported file type: {file_type}"]
                )
            
            return DataIngestionResult(
                source_type=DataSourceType.PLAYBOOK,
                success=True,
                records_processed=len(rules),
                metadata={
                    "rules_extracted": len(rules),
                    "rule_types": list(set(r.get("type") for r in rules))
                }
            )
            
        except Exception as e:
            logger.error(f"Error ingesting playbook data: {e}")
            return DataIngestionResult(
                source_type=DataSourceType.PLAYBOOK,
                success=False,
                errors=[str(e)]
            )
    
    async def _parse_playbook_csv(
        self,
        session_id: UUID,
        file_path: str = None,
        file_content: str = None
    ) -> List[Dict]:
        """Parse playbook rules from CSV."""
        
        df = self._load_file(file_path, file_content, "csv")
        df = self._normalize_columns(df)
        
        # Clear existing rules
        await self.session.execute(
            delete(PlaybookRule).where(PlaybookRule.session_id == session_id)
        )
        
        rules = []
        for _, row in df.iterrows():
            rule = PlaybookRule(
                session_id=session_id,
                rule_id=str(row.get("rule_id", "")) if pd.notna(row.get("rule_id")) else None,
                rule_name=str(row.get("rule_name", row.get("name", "Unknown Rule"))),
                rule_description=str(row.get("description", "")) if pd.notna(row.get("description")) else None,
                category=str(row.get("category", "")) if pd.notna(row.get("category")) else None,
                metric_name=str(row.get("metric", "")) if pd.notna(row.get("metric")) else None,
                threshold_value=str(row.get("threshold", "")) if pd.notna(row.get("threshold")) else None,
                threshold_operator=str(row.get("operator", "")) if pd.notna(row.get("operator")) else None,
                rule_type=str(row.get("type", "general")) if pd.notna(row.get("type")) else "general",
                priority=str(row.get("priority", "MEDIUM")).upper(),
                risk_level=str(row.get("risk_level", "")) if pd.notna(row.get("risk_level")) else None,
                action_recommendation=str(row.get("action", "")) if pd.notna(row.get("action")) else None,
                source_file=file_path,
                source_type="csv"
            )
            self.session.add(rule)
            rules.append({"name": rule.rule_name, "type": rule.rule_type})
        
        await self.session.commit()
        return rules
    
    async def _parse_playbook_markdown(
        self,
        session_id: UUID,
        file_path: str = None,
        file_content: str = None
    ) -> List[Dict]:
        """Parse playbook rules from Markdown (extract thresholds and recommendations)."""
        
        if file_content is None and file_path:
            with open(file_path, "r", encoding="utf-8") as f:
                file_content = f.read()
        
        # Clear existing rules
        await self.session.execute(
            delete(PlaybookRule).where(
                PlaybookRule.session_id == session_id,
                PlaybookRule.source_file == file_path
            )
        )
        
        rules = []
        
        # Extract threshold patterns like "40%", "3 suppliers", "$1M"
        threshold_pattern = r"(?:threshold|limit|minimum|maximum|at least|no more than)[:\s]+(\d+(?:\.\d+)?%?|\$[\d,]+[KMB]?)"
        thresholds = re.findall(threshold_pattern, file_content, re.IGNORECASE)
        
        # Extract sections as potential rules
        sections = re.split(r"\n##\s+", file_content)
        
        for i, section in enumerate(sections[1:], 1):  # Skip first section
            lines = section.split("\n")
            title = lines[0].strip()
            content = "\n".join(lines[1:])
            
            # Determine rule type from content
            rule_type = "general"
            if any(word in content.lower() for word in ["risk", "threat", "vulnerability"]):
                rule_type = "risk"
            elif any(word in content.lower() for word in ["cost", "price", "savings", "spend"]):
                rule_type = "cost"
            elif any(word in content.lower() for word in ["quality", "rating", "performance"]):
                rule_type = "quality"
            
            rule = PlaybookRule(
                session_id=session_id,
                rule_id=f"MD-{i:03d}",
                rule_name=title,
                rule_description=content[:500] if content else None,
                rule_type=rule_type,
                priority="MEDIUM",
                source_file=file_path,
                source_type="markdown"
            )
            self.session.add(rule)
            rules.append({"name": title, "type": rule_type})
        
        await self.session.commit()
        return rules
    
    # ========================
    # CROSS-REFERENCE ENGINE
    # ========================
    
    async def build_cross_references(self, session_id: UUID) -> int:
        """
        Build cross-references between all data sources.
        Links suppliers across spend, master, and contracts.
        """
        logger.info(f"Building cross-references for session {session_id}")
        
        # Clear existing cross-references
        await self.session.execute(
            delete(DataCrossReference).where(DataCrossReference.session_id == session_id)
        )
        
        # Get all supplier profiles
        profiles_result = await self.session.execute(
            select(SupplierProfile).where(SupplierProfile.session_id == session_id)
        )
        profiles = {p.supplier_name.lower(): p for p in profiles_result.scalars().all()}
        
        # Get all contracts
        contracts_result = await self.session.execute(
            select(ContractSummary).where(ContractSummary.session_id == session_id)
        )
        contracts = contracts_result.scalars().all()
        
        links_created = 0
        
        # Link contracts to supplier profiles
        for contract in contracts:
            if contract.supplier_name:
                profile = profiles.get(contract.supplier_name.lower())
                
                if profile:
                    # Exact match
                    xref = DataCrossReference(
                        session_id=session_id,
                        source_type="contract",
                        source_id=str(contract.id),
                        source_field="supplier_name",
                        target_type="supplier",
                        target_id=str(profile.id),
                        target_field="supplier_name",
                        match_type="exact",
                        confidence=1.0
                    )
                    self.session.add(xref)
                    links_created += 1
                    
                    # Update profile with contract link
                    profile.linked_contract_id = contract.id
                else:
                    # Try fuzzy match
                    for profile_name, profile in profiles.items():
                        if self._fuzzy_match(contract.supplier_name.lower(), profile_name):
                            xref = DataCrossReference(
                                session_id=session_id,
                                source_type="contract",
                                source_id=str(contract.id),
                                source_field="supplier_name",
                                target_type="supplier",
                                target_id=str(profile.id),
                                target_field="supplier_name",
                                match_type="fuzzy",
                                confidence=0.8
                            )
                            self.session.add(xref)
                            links_created += 1
                            break
        
        await self.session.commit()
        logger.info(f"Created {links_created} cross-references")
        return links_created
    
    def _fuzzy_match(self, str1: str, str2: str, threshold: float = 0.7) -> bool:
        """Simple fuzzy matching based on common tokens."""
        tokens1 = set(str1.lower().split())
        tokens2 = set(str2.lower().split())
        
        if not tokens1 or not tokens2:
            return False
        
        intersection = tokens1.intersection(tokens2)
        union = tokens1.union(tokens2)
        
        similarity = len(intersection) / len(union)
        return similarity >= threshold
    
    # ========================
    # UTILITY METHODS
    # ========================
    
    def _load_file(
        self,
        file_path: str = None,
        file_content: str = None,
        file_type: str = "csv"
    ) -> pd.DataFrame:
        """Load file into pandas DataFrame."""
        
        if file_content:
            if file_type == "csv":
                return pd.read_csv(StringIO(file_content))
            elif file_type in ["xlsx", "xls"]:
                return pd.read_excel(StringIO(file_content))
        
        if file_path:
            if file_type == "csv":
                return pd.read_csv(file_path)
            elif file_type in ["xlsx", "xls"]:
                return pd.read_excel(file_path)
        
        raise ValueError("Either file_path or file_content must be provided")
    
    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalize column names (lowercase, underscore-separated)."""
        df.columns = [
            col.lower().strip().replace(" ", "_").replace("-", "_")
            for col in df.columns
        ]
        return df
    
    def _validate_columns(
        self,
        df: pd.DataFrame,
        column_spec: Dict[str, List[str]]
    ) -> Dict:
        """Validate dataframe has required columns."""
        
        errors = []
        warnings = []
        
        # Check required columns
        for col in column_spec["required"]:
            if col not in df.columns:
                errors.append(f"Missing required column: {col}")
        
        # Check optional columns
        for col in column_spec["optional"]:
            if col not in df.columns:
                warnings.append(f"Optional column not found: {col}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    def _safe_float(self, value: Any) -> Optional[float]:
        """Safely convert value to float."""
        if pd.isna(value):
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _safe_bool(self, value: Any) -> bool:
        """Safely convert value to bool."""
        if pd.isna(value):
            return False
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ["true", "yes", "1", "y"]
        return bool(value)
    
    def _parse_date(self, value: Any) -> Optional[date]:
        """Parse date from various formats."""
        if pd.isna(value):
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        
        try:
            # Try common date formats
            for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]:
                try:
                    return datetime.strptime(str(value), fmt).date()
                except ValueError:
                    continue
            
            # Pandas parsing as fallback
            return pd.to_datetime(value).date()
        except:
            return None


# ========================
# CONVENIENCE FUNCTIONS
# ========================

async def ingest_all_data_sources(
    session: AsyncSession,
    session_id: UUID,
    spend_file: str = None,
    supplier_file: str = None,
    contract_file: str = None,
    playbook_file: str = None
) -> Dict[str, DataIngestionResult]:
    """
    Convenience function to ingest all data sources at once.
    Returns dictionary of results per source type.
    """
    service = DataIngestionService(session)
    results = {}
    
    if spend_file:
        file_type = spend_file.split(".")[-1].lower()
        results[DataSourceType.SPEND] = await service.ingest_spend_data(
            session_id, file_path=spend_file, file_type=file_type
        )
    
    if supplier_file:
        file_type = supplier_file.split(".")[-1].lower()
        results[DataSourceType.SUPPLIER] = await service.ingest_supplier_data(
            session_id, file_path=supplier_file, file_type=file_type
        )
    
    if contract_file:
        file_type = contract_file.split(".")[-1].lower()
        results[DataSourceType.CONTRACT] = await service.ingest_contract_data(
            session_id, file_path=contract_file, file_type=file_type
        )
    
    if playbook_file:
        file_type = playbook_file.split(".")[-1].lower()
        results[DataSourceType.PLAYBOOK] = await service.ingest_playbook_data(
            session_id, file_path=playbook_file, file_type=file_type
        )
    
    # Build cross-references after all data is ingested
    if any(results.values()):
        await service.build_cross_references(session_id)
    
    return results
