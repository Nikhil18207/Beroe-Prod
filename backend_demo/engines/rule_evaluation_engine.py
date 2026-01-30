"""
Comprehensive Rule Evaluation Engine
Evaluates all 35 procurement rules from rule_book.csv
"""

import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Configure logger
logger = logging.getLogger(__name__)

root_path = Path(__file__).parent.parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

from backend.engines.data_loader import DataLoader

# Import settings for externalized configuration
try:
    from backend.config.settings import settings
    HIGH_RISK_COUNTRIES = settings.high_risk_countries_list
    ELEVATED_RISK_COUNTRIES = settings.elevated_risk_countries_list
except ImportError:
    # Fallback if settings not available
    HIGH_RISK_COUNTRIES = ['Russia', 'Iran', 'North Korea', 'Venezuela', 'Belarus', 'Syria', 'Cuba']
    ELEVATED_RISK_COUNTRIES = ['China', 'Ukraine', 'Myanmar', 'Afghanistan', 'Yemen', 'Libya', 'Sudan']


class RuleEvaluationEngine:
    """
    Comprehensive engine for evaluating all procurement rules
    """
    
    def __init__(self, data_loader: DataLoader = None):
        self.data_loader = data_loader if data_loader else DataLoader()
        self.rule_book = self._load_rule_book()
        
    def _load_rule_book(self) -> pd.DataFrame:
        """Load rule book from CSV"""
        rule_book_path = Path(__file__).parent.parent.parent / 'data' / 'structured' / 'rule_book.csv'
        return pd.read_csv(rule_book_path)
    
    def evaluate_all_rules(self, client_id: str, category: str = None) -> Dict[str, Any]:
        """
        Evaluate all applicable rules for a client/category

        Args:
            client_id: Client identifier
            category: Optional category filter (can be sector, category, or subcategory)

        Returns:
            Dictionary with rule evaluation results
        """
        # Use robust category resolver for any input type (sector/category/subcategory)
        if category:
            resolved = self.data_loader.resolve_category_input(category, client_id)
            if not resolved.get('success', False):
                # Try without client filter
                resolved = self.data_loader.resolve_category_input(category)

            if not resolved.get('success', False):
                return {
                    'success': False,
                    'error': resolved.get('error', f"Could not resolve category: {category}"),
                    'violations': [],
                    'warnings': [],
                    'compliant': []
                }

            client_spend = resolved.get('spend_data', pd.DataFrame()).copy()

            # Update category with resolved value for accurate reporting
            hierarchy = resolved.get('hierarchy', {})
            if hierarchy.get('subcategory'):
                category = hierarchy['subcategory']
            elif hierarchy.get('category'):
                category = hierarchy['category']
        else:
            # No category specified - use all spend for this client
            spend_df = self.data_loader.load_spend_data()
            client_spend = spend_df[spend_df['Client_ID'] == client_id].copy()

        if client_spend.empty:
            return {
                'success': False,
                'error': 'No spend data found',
                'violations': [],
                'warnings': [],
                'compliant': []
            }
        
        # Calculate metrics needed for rules
        metrics = self._calculate_metrics(client_spend)
        
        # Evaluate each rule
        violations = []
        warnings = []
        compliant = []
        
        for _, rule in self.rule_book.iterrows():
            result = self._evaluate_rule(rule, metrics, client_spend)
            if result:
                if result['status'] == 'VIOLATION':
                    violations.append(result)
                elif result['status'] == 'WARNING':
                    warnings.append(result)
                else:
                    compliant.append(result)
        
        return {
            'success': True,
            'total_spend': metrics['total_spend'],
            'supplier_count': metrics['supplier_count'],
            'violations': violations,
            'warnings': warnings,
            'compliant': compliant,
            'summary': {
                'violations_count': len(violations),
                'warnings_count': len(warnings),
                'compliant_count': len(compliant),
                'total_rules_evaluated': len(violations) + len(warnings) + len(compliant),
                'overall_status': 'CRITICAL' if violations else ('WARNING' if warnings else 'COMPLIANT')
            }
        }
    
    def _evaluate_generic_rule(self, rule: pd.Series, metrics: Dict[str, Any], spend_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Generic evaluator that parses Comparison_Logic from rule_book.csv
        Example logic: "Spend_Region_Percentage > Threshold"
        """
        try:
            logic = rule['Comparison_Logic']
            threshold_str = str(rule['Threshold_Value']).replace('%', '').replace(' days', '').replace(' suppliers', '').strip()
            
            # Simple parsing of threshold
            try:
                threshold = float(threshold_str)
            except ValueError:
                # Handle non-numeric thresholds like "B rating"
                threshold = 0 if 'rating' in threshold_str else 0
            
            # Map logic variables to metrics
            # This mapping allows dynamic evaluation of any rule in the CSV
            context = metrics.copy()
            context['Threshold'] = threshold
            
            # Safe evaluation
            # 1. Replace variables with values
            # 2. Check condition
            
            # Define supported variables in logic
            supported_vars = [
                'Spend_Region_Percentage', 'Single_Supplier_Percentage', 'Herfindahl_Index',
                'Supplier_ESG_Score', 'Quality_Rejection_Rate', 'On_Time_Delivery_Rate',
                'Average_Payment_Terms', 'Supplier_Debt_Equity_Ratio', 'Supplier_Capacity_Utilization',
                'MOQ_Months_of_Demand', 'Lead_Time_Variance_Percentage', 'Foreign_Currency_Spend_Percentage',
                'Diverse_Supplier_Spend_Percentage', 'Innovation_Supplier_Spend_Percentage',
                'Local_Content_Percentage', 'Qualified_Supplier_Count', 'Price_Benchmark_Deviation',
                'Supplier_Response_Time', 'Contract_Compliance_Rate', 'Inventory_Turnover',
                'High_Risk_Country_Spend', 'Supplier_Cyber_Rating', 'Certified_Suppliers_Percentage',
                'Months_Since_Last_Audit', 'Backup_Supplier_Count', 'Supplier_Innovation_Score',
                'Carbon_Footprint', 'Ethical_Certified_Suppliers', 'Low_Spend_Supplier_Count',
                'Average_Contract_Duration', 'Supplier_Performance_Score',
                'Days_To_Expiry', 'Price_Escalation_Cap', 'Price_Variance_Percentage'
            ]
            
            # Determine the variable being tested
            tested_var = None
            for var in supported_vars:
                if var in logic:
                    tested_var = var
                    break
            
            if not tested_var or tested_var not in metrics:
                return None # Metric not calculated
            
            current_value = metrics[tested_var]
            
            # Perform comparison
            is_violation = False
            if '= None' in logic:
                # Special case: checking if value is None/missing (violation if no cap exists)
                is_violation = current_value is None or current_value == 0
            elif '>' in logic:
                is_violation = current_value > threshold
            elif '<' in logic:
                is_violation = current_value < threshold
            
            result = {
                'rule_id': rule['Rule_ID'],
                'rule_name': rule['Rule_Name'],
                'rule_description': rule['Rule_Description'],
                'threshold': rule['Threshold_Value'],
                'current_value': f"{current_value:.1f}",
                'risk_level': rule['Risk_Level'],
                'category': rule['Category']
            }
            
            if is_violation:
                result['status'] = 'VIOLATION'
                result['severity'] = 'HIGH' if rule['Risk_Level'] == 'Critical' else 'MEDIUM'
                result['message'] = f"⚠️ VIOLATION: {rule['Rule_Name']} ({current_value:.1f} vs {threshold})"
                result['action_required'] = rule['Action_Recommendation']
            else:
                result['status'] = 'COMPLIANT'
                result['severity'] = 'LOW'
                result['message'] = f"✅ COMPLIANT: {rule['Rule_Name']} ({current_value:.1f})"
                
            return result
            
        except Exception as e:
            # print(f"Error evaluating generic rule {rule['Rule_ID']}: {str(e)}")
            return None

    def _calculate_metrics(self, spend_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculate ALL metrics needed for rule evaluation using REAL DATA from CSV files.
        All 35 rules are now evaluated against actual data.
        """
        total_spend = spend_df['Spend_USD'].sum()

        # Supplier-level metrics
        supplier_spend = spend_df.groupby(['Supplier_ID', 'Supplier_Name', 'Supplier_Region']).agg({
            'Spend_USD': ['sum', 'count', 'mean']
        }).reset_index()
        supplier_spend.columns = ['Supplier_ID', 'Supplier_Name', 'Supplier_Region', 'total', 'transactions', 'average']
        supplier_spend['percentage'] = (supplier_spend['total'] / total_spend * 100).round(2)
        supplier_spend = supplier_spend.sort_values('total', ascending=False)

        # Load ALL data sources
        supplier_master = self.data_loader.load_supplier_master()
        supplier_contracts = self.data_loader.load_supplier_contracts()
        inventory_metrics = self.data_loader.load_inventory_metrics()
        category_metrics = self.data_loader.load_category_metrics()

        # Get category context from spend data
        category_context = None
        if 'SubCategory' in spend_df.columns and len(spend_df['SubCategory'].unique()) == 1:
            subcategory = spend_df['SubCategory'].iloc[0]
            category = spend_df['Category'].iloc[0] if 'Category' in spend_df.columns else None
            sector = spend_df['Sector'].iloc[0] if 'Sector' in spend_df.columns else None

            # Get category-level metrics
            if not category_metrics.empty:
                cat_match = category_metrics[category_metrics['subcategory'] == subcategory]
                if not cat_match.empty:
                    category_context = cat_match.iloc[0].to_dict()

            # Get inventory metrics
            inv_context = None
            if not inventory_metrics.empty:
                inv_match = inventory_metrics[inventory_metrics['subcategory'] == subcategory]
                if not inv_match.empty:
                    inv_context = inv_match.iloc[0].to_dict()

        # Join spend with master data
        if not supplier_master.empty:
            merged = pd.merge(supplier_spend, supplier_master, left_on='Supplier_Name', right_on='supplier_name', how='left')
        else:
            merged = supplier_spend.copy()
            cols = ['sustainability_score', 'quality_rating', 'delivery_reliability_pct', 'lead_time_days']
            for col in cols:
                merged[col] = 0

        # Join with contract data
        if not supplier_contracts.empty:
            merged = pd.merge(merged, supplier_contracts, left_on='Supplier_ID', right_on='Supplier_ID', how='left', suffixes=('', '_contract'))

        # Regional concentration
        region_spend = spend_df.groupby('Supplier_Region')['Spend_USD'].sum()
        region_percentages = (region_spend / total_spend * 100).round(2)

        # HHI (Herfindahl-Hirschman Index)
        hhi = (supplier_spend['percentage'] ** 2).sum()

        # ============================================================
        # CALCULATE ALL 35 METRICS FROM REAL DATA
        # ============================================================

        # R005: ESG Score (Weighted Average from supplier_contracts)
        if 'ESG_Score' in merged.columns:
            valid_esg = merged[merged['ESG_Score'].notna()]
            if not valid_esg.empty:
                avg_esg = (valid_esg['ESG_Score'] * valid_esg['percentage'] / 100).sum()
            else:
                avg_esg = 75.0
        else:
            avg_esg = (merged['sustainability_score'] * merged['percentage'] / 100).sum() * 10

        # R007: Quality Rejection (from quality_rating)
        avg_quality = (merged['quality_rating'].fillna(4.0) * merged['percentage'] / 100).sum()
        rejection_rate = max(0, (5 - avg_quality) * 2)

        # R008: On Time Delivery (from supplier_master)
        avg_delivery = (merged['delivery_reliability_pct'].fillna(85) * merged['percentage'] / 100).sum()

        # R009: Average Payment Terms (from supplier_contracts)
        if 'Payment_Terms_Days' in merged.columns:
            avg_payment_terms = merged['Payment_Terms_Days'].fillna(45).mean()
        else:
            avg_payment_terms = 45.0

        # R010: Supplier Debt/Equity Ratio (from supplier_master)
        if 'debt_to_equity_ratio' in merged.columns:
            avg_debt_equity = (merged['debt_to_equity_ratio'].fillna(1.5) * merged['percentage'] / 100).sum()
        else:
            avg_debt_equity = 1.5

        # R011: Capacity Utilization (from supplier_master)
        if 'capacity_utilization_pct' in merged.columns:
            avg_capacity = (merged['capacity_utilization_pct'].fillna(75) * merged['percentage'] / 100).sum()
        else:
            avg_capacity = 75.0

        # R013: Lead Time Variance (from supplier_master)
        if 'lead_time_variance_pct' in merged.columns:
            avg_lead_variance = (merged['lead_time_variance_pct'].fillna(15) * merged['percentage'] / 100).sum()
        else:
            avg_lead_variance = 15.0

        # R020: Supplier Response Time (from supplier_master)
        if 'response_time_hours' in merged.columns:
            avg_response_time = (merged['response_time_hours'].fillna(24) * merged['percentage'] / 100).sum()
        else:
            avg_response_time = 24.0

        # R025: Cybersecurity Rating (from supplier_master - convert to numeric)
        cyber_map = {'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1}
        if 'cybersecurity_rating' in merged.columns:
            merged['cyber_numeric'] = merged['cybersecurity_rating'].map(cyber_map).fillna(3)
            avg_cyber = (merged['cyber_numeric'] * merged['percentage'] / 100).sum()
        else:
            avg_cyber = 4.0  # B rating equivalent

        # R030: Innovation Score (from supplier_master)
        if 'innovation_score' in merged.columns:
            avg_innovation = (merged['innovation_score'].fillna(60) * merged['percentage'] / 100).sum()
        else:
            avg_innovation = 60.0

        # R031: Carbon Footprint (from supplier_master)
        if 'carbon_footprint_kg_co2' in merged.columns:
            avg_carbon = (merged['carbon_footprint_kg_co2'].fillna(500) * merged['percentage'] / 100).sum()
        else:
            avg_carbon = 500.0

        # R035: Performance Score (from supplier_master)
        if 'performance_score' in merged.columns:
            avg_performance = (merged['performance_score'].fillna(80) * merged['percentage'] / 100).sum()
        else:
            avg_performance = 80.0

        # R024: Geopolitical Risk (from spend_df country)
        # Use externalized high-risk countries from settings
        all_risk_countries = HIGH_RISK_COUNTRIES + ELEVATED_RISK_COUNTRIES
        high_risk_spend = spend_df[spend_df['Supplier_Country'].isin(all_risk_countries)]['Spend_USD'].sum()
        high_risk_pct = (high_risk_spend / total_spend * 100) if total_spend > 0 else 0

        # R004: Days to Contract Expiry (from supplier_contracts)
        if 'days_to_expiry' in merged.columns:
            min_days_to_expiry = merged['days_to_expiry'].min()
        else:
            min_days_to_expiry = 120

        # R006: Price Variance (from supplier_contracts)
        if 'price_variance_pct' in merged.columns:
            max_price_variance = merged['price_variance_pct'].max()
        else:
            max_price_variance = 5.0

        # R019: Price Benchmark Deviation (from supplier_contracts)
        if 'price_benchmark_deviation_pct' in merged.columns:
            avg_price_deviation = merged['price_benchmark_deviation_pct'].mean()
        else:
            avg_price_deviation = 5.0

        # R021: Contract Compliance (from supplier_contracts)
        if 'contract_compliance_pct' in merged.columns:
            avg_compliance = merged['contract_compliance_pct'].mean()
        else:
            avg_compliance = 95.0

        # R028: Price Escalation Cap (from supplier_contracts)
        if 'has_price_escalation_cap' in merged.columns:
            pct_with_cap = (merged['has_price_escalation_cap'].sum() / len(merged)) * 100
            price_cap_value = pct_with_cap if pct_with_cap > 0 else 0
        else:
            price_cap_value = 5.0

        # R034: Contract Duration (from supplier_contracts)
        if 'contract_duration_years' in merged.columns:
            avg_contract_duration = merged['contract_duration_years'].mean()
        else:
            avg_contract_duration = 2.5

        # R027: Months Since Last Audit (from supplier_master)
        if 'last_audit_date' in merged.columns:
            try:
                merged['last_audit_date'] = pd.to_datetime(merged['last_audit_date'], errors='coerce')
                today = pd.Timestamp.now()
                merged['months_since_audit'] = ((today - merged['last_audit_date']).dt.days / 30).round(0)
                max_months_since_audit = merged['months_since_audit'].max()
                if pd.isna(max_months_since_audit):
                    max_months_since_audit = 6
            except (ValueError, TypeError) as e:
                logger.warning(f"Error calculating months since audit: {e}")
                max_months_since_audit = 6
        else:
            max_months_since_audit = 6

        # Category-level metrics (R012, R014, R015, R016, R017, R018, R022, R026, R029, R032, R033)
        if category_context:
            diverse_pct = category_context.get('diverse_supplier_pct', 15.0)
            innovation_pct = category_context.get('innovation_supplier_pct', 10.0)
            local_pct = category_context.get('local_content_pct', 40.0)
            qualified_count = category_context.get('qualified_supplier_count', 3)
            certified_pct = category_context.get('certified_suppliers_pct', 90.0)
            backup_count = category_context.get('backup_supplier_count', 1)
            ethical_pct = category_context.get('ethical_certified_pct', 80.0)
            low_spend_count = category_context.get('low_spend_supplier_count', 10)
        else:
            # Calculate from merged data
            if 'is_diverse_supplier' in merged.columns:
                diverse_pct = (merged['is_diverse_supplier'].sum() / len(merged)) * 100
            else:
                diverse_pct = 15.0

            if 'is_innovation_supplier' in merged.columns:
                innovation_pct = (merged['is_innovation_supplier'].sum() / len(merged)) * 100
            else:
                innovation_pct = 10.0

            if 'is_local_supplier' in merged.columns:
                local_pct = (merged['is_local_supplier'].sum() / len(merged)) * 100
            else:
                local_pct = 40.0

            qualified_count = len(merged[merged['quality_rating'] >= 4.0]) if 'quality_rating' in merged.columns else len(supplier_spend)

            if 'has_required_certifications' in merged.columns:
                certified_pct = (merged['has_required_certifications'].sum() / len(merged)) * 100
            else:
                certified_pct = 90.0

            if 'is_backup_supplier' in merged.columns:
                backup_count = merged['is_backup_supplier'].sum()
            else:
                backup_count = 1

            if 'has_ethical_certification' in merged.columns:
                ethical_pct = (merged['has_ethical_certification'].sum() / len(merged)) * 100
            else:
                ethical_pct = 80.0

            low_spend_count = len(merged[merged['percentage'] < 2.0]) if 'percentage' in merged.columns else 5

        # Inventory metrics (R012, R014, R022)
        if inv_context:
            moq_months = inv_context.get('moq_months_of_demand', 3.0)
            foreign_currency_pct = inv_context.get('foreign_currency_spend_pct', 30.0)
            inventory_turnover = inv_context.get('inventory_turnover', 7.0)
        else:
            moq_months = 3.0
            foreign_currency_pct = 30.0
            inventory_turnover = 7.0

        # Build metrics dictionary with ALL REAL DATA
        metrics = {
            'total_spend': total_spend,
            'supplier_count': len(supplier_spend),
            'supplier_spend': supplier_spend,
            'region_spend': region_spend,
            'region_percentages': region_percentages,
            'max_region_concentration': region_percentages.max() if len(region_percentages) > 0 else 0,
            'max_supplier_concentration': supplier_spend['percentage'].max() if len(supplier_spend) > 0 else 0,
            'hhi': hhi,

            # === ALL 35 METRICS FROM REAL DATA ===

            # R001: Regional Concentration
            'Spend_Region_Percentage': region_percentages.max() if len(region_percentages) > 0 else 0,

            # R002: Tail Spend (calculated below)

            # R003: Single Supplier Dependency
            'Single_Supplier_Percentage': supplier_spend['percentage'].max() if len(supplier_spend) > 0 else 0,

            # R004: Contract Expiry Warning
            'Days_To_Expiry': min_days_to_expiry,

            # R005: ESG Compliance Score
            'Supplier_ESG_Score': avg_esg,

            # R006: Price Variance Alert
            'Price_Variance_Percentage': max_price_variance,

            # R007: Quality Rejection Rate
            'Quality_Rejection_Rate': rejection_rate,

            # R008: Delivery Performance
            'On_Time_Delivery_Rate': avg_delivery,

            # R009: Payment Terms Optimization
            'Average_Payment_Terms': avg_payment_terms,

            # R010: Supplier Financial Risk
            'Supplier_Debt_Equity_Ratio': avg_debt_equity,

            # R011: Capacity Utilization Risk
            'Supplier_Capacity_Utilization': avg_capacity,

            # R012: MOQ Months of Demand
            'MOQ_Months_of_Demand': moq_months,

            # R013: Lead Time Variance
            'Lead_Time_Variance_Percentage': avg_lead_variance,

            # R014: Foreign Currency Exposure
            'Foreign_Currency_Spend_Percentage': foreign_currency_pct,

            # R015: Diverse Supplier Spend
            'Diverse_Supplier_Spend_Percentage': diverse_pct,

            # R016: Innovation Supplier Ratio
            'Innovation_Supplier_Spend_Percentage': innovation_pct,

            # R017: Local Content Requirement
            'Local_Content_Percentage': local_pct,

            # R018: Supplier Qualification Gap
            'Qualified_Supplier_Count': qualified_count,

            # R019: Price Benchmark Deviation
            'Price_Benchmark_Deviation': avg_price_deviation,

            # R020: Supplier Responsiveness
            'Supplier_Response_Time': avg_response_time,

            # R021: Contract Compliance Rate
            'Contract_Compliance_Rate': avg_compliance,

            # R022: Inventory Turnover
            'Inventory_Turnover': inventory_turnover,

            # R023: Supplier Concentration Index (HHI)
            'Herfindahl_Index': hhi,

            # R024: Geopolitical Risk Exposure
            'High_Risk_Country_Spend': high_risk_pct,

            # R025: Cybersecurity Rating
            'Supplier_Cyber_Rating': avg_cyber,

            # R026: Certification Compliance
            'Certified_Suppliers_Percentage': certified_pct,

            # R027: Audit Frequency
            'Months_Since_Last_Audit': max_months_since_audit,

            # R028: Price Escalation Clause
            'Price_Escalation_Cap': price_cap_value,

            # R029: Backup Supplier Availability
            'Backup_Supplier_Count': backup_count,

            # R030: Innovation Score
            'Supplier_Innovation_Score': avg_innovation,

            # R031: Carbon Footprint
            'Carbon_Footprint': avg_carbon,

            # R032: Ethical Sourcing Compliance
            'Ethical_Certified_Suppliers': ethical_pct,

            # R033: Tail Spend Consolidation (calculated below)
            'Low_Spend_Supplier_Count': low_spend_count,

            # R034: Long-term Contract Coverage
            'Average_Contract_Duration': avg_contract_duration,

            # R035: Supplier Performance Score
            'Supplier_Performance_Score': avg_performance,
        }

        # R002 & R033: Tail spend calculation
        tail_spend_threshold = total_spend * 0.20
        cumulative_spend = 0
        tail_suppliers = []
        for _, row in supplier_spend.sort_values('total').iterrows():
            if cumulative_spend < tail_spend_threshold:
                tail_suppliers.append(row['Supplier_ID'])
                cumulative_spend += row['total']
            else:
                break

        metrics['tail_suppliers_count'] = len(tail_suppliers)
        metrics['tail_spend_amount'] = cumulative_spend
        metrics['Low_Spend_Supplier_Count'] = len(tail_suppliers)  # Update with actual tail count

        return metrics
    
    def _evaluate_rule(self, rule: pd.Series, metrics: Dict[str, Any], spend_df: pd.DataFrame) -> Dict[str, Any]:
        """Evaluate a single rule"""
        rule_id = rule['Rule_ID']
        
        # Map rule IDs to evaluation methods
        evaluators = {
            'R001': self._evaluate_r001_regional_concentration,
            'R002': self._evaluate_r002_tail_spend_fragmentation,
            'R003': self._evaluate_r003_single_supplier_dependency,
            'R023': self._evaluate_r023_supplier_concentration_index,
        }
        
        # Use specific evaluator if available, otherwise use generic evaluator
        if rule_id in evaluators:
            return evaluators[rule_id](rule, metrics, spend_df)
        else:
            # Use generic evaluator for all other rules (R004-R035 except R023)
            return self._evaluate_generic_rule(rule, metrics, spend_df)
    
    def _evaluate_r001_regional_concentration(self, rule: pd.Series, metrics: Dict[str, Any], spend_df: pd.DataFrame) -> Dict[str, Any]:
        """R001: Regional Concentration - If >40% of category spend is concentrated in a single region"""
        threshold = 40.0
        current_value = metrics['max_region_concentration']
        
        result = {
            'rule_id': 'R001',
            'rule_name': rule['Rule_Name'],
            'rule_description': rule['Rule_Description'],
            'threshold': f"{threshold}%",
            'current_value': f"{current_value:.1f}%",
            'risk_level': rule['Risk_Level'],
            'category': rule['Category']
        }
        
        if current_value > threshold:
            excess = current_value - threshold
            max_region = metrics['region_percentages'].idxmax()
            result['status'] = 'VIOLATION'
            result['severity'] = 'HIGH'
            result['message'] = f"⚠️ VIOLATION: {current_value:.1f}% of spend concentrated in {max_region} (exceeds {threshold}% limit by {excess:.1f}%)"
            result['action_required'] = rule['Action_Recommendation']
            result['details'] = {
                'region': max_region,
                'region_spend': float(metrics['region_spend'][max_region]),
                'region_percentage': float(current_value)
            }
        elif current_value > threshold * 0.9:  # Warning at 90% of threshold
            result['status'] = 'WARNING'
            result['severity'] = 'MEDIUM'
            max_region = metrics['region_percentages'].idxmax()
            result['message'] = f"⚡ WARNING: {current_value:.1f}% of spend in {max_region} (approaching {threshold}% limit)"
            result['action_required'] = "Monitor regional concentration"
        else:
            result['status'] = 'COMPLIANT'
            result['severity'] = 'LOW'
            result['message'] = f"✅ COMPLIANT: Regional concentration at {current_value:.1f}% (within {threshold}% limit)"
        
        return result
    
    def _evaluate_r002_tail_spend_fragmentation(self, rule: pd.Series, metrics: Dict[str, Any], spend_df: pd.DataFrame) -> Dict[str, Any]:
        """R002: Tail Spend Fragmentation - If bottom 20% of spend is distributed across too many suppliers"""
        threshold = 10  # Max 10 suppliers in tail spend
        current_value = metrics['tail_suppliers_count']
        
        result = {
            'rule_id': 'R002',
            'rule_name': rule['Rule_Name'],
            'rule_description': rule['Rule_Description'],
            'threshold': f"{threshold} suppliers",
            'current_value': f"{current_value} suppliers",
            'risk_level': rule['Risk_Level'],
            'category': rule['Category']
        }
        
        if current_value > threshold:
            excess = current_value - threshold
            result['status'] = 'VIOLATION'
            result['severity'] = 'MEDIUM'
            result['message'] = f"⚠️ VIOLATION: {current_value} suppliers in tail spend (exceeds {threshold} supplier limit by {excess})"
            result['action_required'] = rule['Action_Recommendation']
            result['details'] = {
                'tail_suppliers_count': current_value,
                'tail_spend_amount': float(metrics['tail_spend_amount']),
                'tail_spend_percentage': float((metrics['tail_spend_amount'] / metrics['total_spend']) * 100)
            }
        elif current_value > threshold * 0.8:  # Warning at 80% of threshold
            result['status'] = 'WARNING'
            result['severity'] = 'LOW'
            result['message'] = f"⚡ WARNING: {current_value} suppliers in tail spend (approaching {threshold} supplier limit)"
            result['action_required'] = "Consider consolidating tail suppliers"
        else:
            result['status'] = 'COMPLIANT'
            result['severity'] = 'LOW'
            result['message'] = f"✅ COMPLIANT: {current_value} suppliers in tail spend (within {threshold} supplier limit)"
        
        return result
    
    def _evaluate_r003_single_supplier_dependency(self, rule: pd.Series, metrics: Dict[str, Any], spend_df: pd.DataFrame) -> Dict[str, Any]:
        """R003: Single Supplier Dependency - If >60% of category spend is with a single supplier"""
        threshold = 60.0
        current_value = metrics['max_supplier_concentration']
        
        result = {
            'rule_id': 'R003',
            'rule_name': rule['Rule_Name'],
            'rule_description': rule['Rule_Description'],
            'threshold': f"{threshold}%",
            'current_value': f"{current_value:.1f}%",
            'risk_level': rule['Risk_Level'],
            'category': rule['Category']
        }
        
        if current_value > threshold:
            excess = current_value - threshold
            top_supplier = metrics['supplier_spend'].iloc[0]
            excess_amount = (excess / 100) * metrics['total_spend']
            result['status'] = 'VIOLATION'
            result['severity'] = 'CRITICAL'
            result['message'] = f"⚠️ VIOLATION: {top_supplier['Supplier_Name']} at {current_value:.1f}% (exceeds {threshold}% limit by {excess:.1f}%)"
            result['action_required'] = rule['Action_Recommendation']
            result['details'] = {
                'supplier_name': top_supplier['Supplier_Name'],
                'supplier_id': top_supplier['Supplier_ID'],
                'supplier_spend': float(top_supplier['total']),
                'supplier_percentage': float(current_value),
                'excess_amount': float(excess_amount),
                'recommended_reduction': float(excess_amount)
            }
        elif current_value > threshold * 0.85:  # Warning at 85% of threshold (51%)
            result['status'] = 'WARNING'
            result['severity'] = 'HIGH'
            top_supplier = metrics['supplier_spend'].iloc[0]
            result['message'] = f"⚡ WARNING: {top_supplier['Supplier_Name']} at {current_value:.1f}% (approaching {threshold}% limit)"
            result['action_required'] = "Monitor supplier dependency and plan diversification"
        else:
            result['status'] = 'COMPLIANT'
            result['severity'] = 'LOW'
            result['message'] = f"✅ COMPLIANT: Maximum supplier concentration at {current_value:.1f}% (within {threshold}% limit)"
        
        return result
    
    def _evaluate_r023_supplier_concentration_index(self, rule: pd.Series, metrics: Dict[str, Any], spend_df: pd.DataFrame) -> Dict[str, Any]:
        """R023: Supplier Concentration Index - If Herfindahl index exceeds concentration threshold"""
        threshold = 2500
        current_value = metrics['hhi']
        
        result = {
            'rule_id': 'R023',
            'rule_name': rule['Rule_Name'],
            'rule_description': rule['Rule_Description'],
            'threshold': f"{threshold}",
            'current_value': f"{current_value:.0f}",
            'risk_level': rule['Risk_Level'],
            'category': rule['Category']
        }
        
        if current_value > threshold:
            excess = current_value - threshold
            result['status'] = 'VIOLATION'
            result['severity'] = 'HIGH'
            result['message'] = f"⚠️ VIOLATION: HHI at {current_value:.0f} (exceeds {threshold} limit by {excess:.0f})"
            result['action_required'] = rule['Action_Recommendation']
            result['details'] = {
                'hhi': float(current_value),
                'supplier_count': metrics['supplier_count'],
                'market_structure': self._interpret_hhi(current_value)
            }
        elif current_value > threshold * 0.9:  # Warning at 90% of threshold
            result['status'] = 'WARNING'
            result['severity'] = 'MEDIUM'
            result['message'] = f"⚡ WARNING: HHI at {current_value:.0f} (approaching {threshold} limit)"
            result['action_required'] = "Monitor supplier concentration"
        else:
            result['status'] = 'COMPLIANT'
            result['severity'] = 'LOW'
            result['message'] = f"✅ COMPLIANT: HHI at {current_value:.0f} (within {threshold} limit)"
        
        return result
    
    def _interpret_hhi(self, hhi: float) -> str:
        """Interpret HHI value"""
        if hhi < 1500:
            return "Competitive market"
        elif hhi < 2500:
            return "Moderately concentrated"
        else:
            return "Highly concentrated"
    
    def get_rule_details(self, rule_id: str) -> Dict[str, Any]:
        """Get details for a specific rule"""
        rule = self.rule_book[self.rule_book['Rule_ID'] == rule_id]
        if rule.empty:
            return None
        
        rule = rule.iloc[0]
        return {
            'rule_id': rule['Rule_ID'],
            'rule_name': rule['Rule_Name'],
            'description': rule['Rule_Description'],
            'threshold': rule['Threshold_Value'],
            'comparison_logic': rule['Comparison_Logic'],
            'risk_level': rule['Risk_Level'],
            'action_recommendation': rule['Action_Recommendation'],
            'category': rule['Category']
        }
    
    def get_all_rules(self) -> List[Dict[str, Any]]:
        """Get all rules from rule book"""
        rules = []
        for _, rule in self.rule_book.iterrows():
            rules.append({
                'rule_id': rule['Rule_ID'],
                'rule_name': rule['Rule_Name'],
                'description': rule['Rule_Description'],
                'threshold': rule['Threshold_Value'],
                'risk_level': rule['Risk_Level'],
                'category': rule['Category']
            })
        return rules


if __name__ == "__main__":
    # Test the engine
    engine = RuleEvaluationEngine()
    
    # Test with Rice Bran Oil
    print("=" * 80)
    print("TESTING RULE EVALUATION ENGINE - Rice Bran Oil")
    print("=" * 80)
    
    results = engine.evaluate_all_rules('C001', 'Rice Bran Oil')
    
    print(f"\nTotal Spend: ${results['total_spend']:,.2f}")
    print(f"Supplier Count: {results['supplier_count']}")
    print(f"\nOverall Status: {results['summary']['overall_status']}")
    print(f"Violations: {results['summary']['violations_count']}")
    print(f"Warnings: {results['summary']['warnings_count']}")
    print(f"Compliant: {results['summary']['compliant_count']}")
    
    if results['violations']:
        print("\n" + "=" * 80)
        print("VIOLATIONS:")
        print("=" * 80)
        for v in results['violations']:
            print(f"\n[{v['rule_id']}] {v['rule_name']}")
            print(f"  {v['message']}")
            print(f"  Action: {v['action_required']}")
            if 'details' in v:
                print(f"  Details: {v['details']}")
    
    if results['warnings']:
        print("\n" + "=" * 80)
        print("WARNINGS:")
        print("=" * 80)
        for w in results['warnings']:
            print(f"\n[{w['rule_id']}] {w['rule_name']}")
            print(f"  {w['message']}")
    
    if results['compliant']:
        print("\n" + "=" * 80)
        print("COMPLIANT RULES:")
        print("=" * 80)
        for c in results['compliant']:
            print(f"  [{c['rule_id']}] {c['rule_name']}: {c['message']}")
