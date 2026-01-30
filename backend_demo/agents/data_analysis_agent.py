"""
Data Analysis Agent - Spend analysis and supplier metrics

Responsibilities:
- Calculate spend concentration metrics
- Identify dominant suppliers/regions
- Calculate HHI (Herfindahl-Hirschman Index)
- Supplier performance aggregation
- Regional distribution analysis
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

root_path = Path(__file__).parent.parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

from backend.agents.base_agent import BaseAgent


class DataAnalysisAgent(BaseAgent):
    """
    Agent for analyzing spend data and calculating procurement metrics.

    Key capabilities:
    - Supplier concentration analysis
    - Regional distribution analysis
    - HHI calculation
    - Supplier performance metrics
    - Tail spend analysis
    - Web search fallback for unknown suppliers (inherited from BaseAgent)
    """

    @property
    def agent_name(self) -> str:
        return "DataAnalysisAgent"

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute spend data analysis.

        Args:
            context: Dictionary containing:
                - spend_df: DataFrame with spend data
                - supplier_df: DataFrame with supplier master data
                - category: Category being analyzed
                - client_id: Client identifier

        Returns:
            Dictionary with analysis results
        """
        spend_df = context.get('spend_df')
        supplier_df = context.get('supplier_df', pd.DataFrame())
        category = context.get('category', 'Procurement')

        if spend_df is None or spend_df.empty:
            return {
                'success': False,
                'error': 'No spend data provided',
                'metrics': {}
            }

        try:
            # Calculate all metrics
            total_spend = spend_df['Spend_USD'].sum()

            # Supplier concentration analysis
            supplier_analysis = self._analyze_supplier_concentration(spend_df, total_spend)

            # Regional concentration analysis
            regional_analysis = self._analyze_regional_concentration(spend_df, total_spend)

            # HHI calculation
            hhi = self._calculate_hhi(supplier_analysis['supplier_spend_pct'])

            # Supplier performance (if master data available) with web fallback
            performance_metrics = self._calculate_performance_metrics(
                spend_df, supplier_df, category
            )

            # Tail spend analysis
            tail_analysis = self._analyze_tail_spend(supplier_analysis['supplier_spend'], total_spend)

            return {
                'success': True,
                'total_spend': total_spend,
                'category': category,
                'supplier_analysis': supplier_analysis,
                'regional_analysis': regional_analysis,
                'hhi': hhi,
                'performance_metrics': performance_metrics,
                'tail_analysis': tail_analysis,
                'summary': self._generate_summary(
                    total_spend, supplier_analysis, regional_analysis, hhi
                )
            }

        except Exception as e:
            self.log(f"Analysis failed: {e}", "ERROR")
            return {
                'success': False,
                'error': str(e),
                'metrics': {}
            }

    def _analyze_supplier_concentration(
        self,
        spend_df: pd.DataFrame,
        total_spend: float
    ) -> Dict[str, Any]:
        """Analyze supplier concentration."""
        # Aggregate spend by supplier
        supplier_spend = spend_df.groupby('Supplier_Name')['Spend_USD'].sum()
        supplier_spend_pct = (supplier_spend / total_spend * 100).round(2)
        supplier_spend_sorted = supplier_spend_pct.sort_values(ascending=False)

        num_suppliers = len(supplier_spend_sorted)

        # Build supplier list
        suppliers_list = []
        for supplier_name, pct in supplier_spend_sorted.items():
            suppliers_list.append({
                'name': supplier_name,
                'spend': float(supplier_spend[supplier_name]),
                'pct': float(pct)
            })

        # Dominant supplier info
        dominant_supplier = supplier_spend_sorted.index[0]
        dominant_pct = float(supplier_spend_sorted.iloc[0])
        dominant_spend = float(supplier_spend[dominant_supplier])

        # Get dominant supplier details
        dominant_countries = spend_df[
            spend_df['Supplier_Name'] == dominant_supplier
        ]['Supplier_Country'].unique().tolist()

        dominant_regions = spend_df[
            spend_df['Supplier_Name'] == dominant_supplier
        ]['Supplier_Region'].unique().tolist()

        return {
            'supplier_spend': supplier_spend,
            'supplier_spend_pct': supplier_spend_pct,
            'num_suppliers': num_suppliers,
            'suppliers_list': suppliers_list,
            'dominant_supplier': dominant_supplier,
            'dominant_pct': dominant_pct,
            'dominant_spend': dominant_spend,
            'dominant_countries': dominant_countries,
            'dominant_regions': dominant_regions,
            'top_5_concentration': float(supplier_spend_sorted.head(5).sum())
        }

    def _analyze_regional_concentration(
        self,
        spend_df: pd.DataFrame,
        total_spend: float
    ) -> Dict[str, Any]:
        """Analyze regional concentration."""
        # Country-level analysis
        country_spend = spend_df.groupby('Supplier_Country')['Spend_USD'].sum()
        country_pct = (country_spend / total_spend * 100).round(2)
        country_sorted = country_pct.sort_values(ascending=False)

        # Region-level analysis
        if 'Supplier_Region' in spend_df.columns:
            region_spend = spend_df.groupby('Supplier_Region')['Spend_USD'].sum()
            region_pct = (region_spend / total_spend * 100).round(2)
        else:
            region_spend = country_spend
            region_pct = country_pct

        # Build concentration list
        concentration_list = []
        for country, pct in country_sorted.head(5).items():
            concentration_list.append({
                'country': country,
                'pct': float(pct),
                'spend_usd': float(country_spend[country])
            })

        # Identify high concentration countries (>40%)
        high_concentration_countries = [
            c['country'] for c in concentration_list if c['pct'] > 40
        ]

        total_high_concentration_pct = sum(
            c['pct'] for c in concentration_list if c['pct'] > 40
        )

        # Determine region corridor name
        all_countries = list(country_sorted.index)
        corridor_name = self._get_region_corridor_name(all_countries)

        return {
            'country_spend': country_spend,
            'country_pct': country_pct,
            'region_spend': region_spend,
            'region_pct': region_pct,
            'concentration_list': concentration_list,
            'high_concentration_countries': high_concentration_countries,
            'total_high_concentration_pct': total_high_concentration_pct,
            'dominant_country': country_sorted.index[0] if len(country_sorted) > 0 else 'Unknown',
            'dominant_country_pct': float(country_sorted.iloc[0]) if len(country_sorted) > 0 else 0,
            'corridor_name': corridor_name,
            'all_countries': all_countries
        }

    def _calculate_hhi(self, supplier_spend_pct: pd.Series) -> Dict[str, Any]:
        """Calculate Herfindahl-Hirschman Index."""
        hhi = (supplier_spend_pct ** 2).sum()

        # Interpret HHI
        if hhi < 1500:
            interpretation = "Competitive market"
            concentration_level = "LOW"
        elif hhi < 2500:
            interpretation = "Moderately concentrated"
            concentration_level = "MODERATE"
        else:
            interpretation = "Highly concentrated"
            concentration_level = "HIGH"

        return {
            'value': float(hhi),
            'interpretation': interpretation,
            'concentration_level': concentration_level,
            'threshold_competitive': 1500,
            'threshold_concentrated': 2500
        }

    def _calculate_performance_metrics(
        self,
        spend_df: pd.DataFrame,
        supplier_df: pd.DataFrame,
        category: str = None
    ) -> List[Dict[str, Any]]:
        """
        Calculate supplier performance metrics using Database-First, Web-Fallback pattern.
        
        Args:
            spend_df: Spend data DataFrame
            supplier_df: Supplier master DataFrame
            category: Optional category for web search context
            
        Returns:
            List of supplier metrics dictionaries
        """
        metrics = []
        # Calculate total spend per supplier and sort descending
        supplier_spend_series = spend_df.groupby('Supplier_Name')['Spend_USD'].sum().sort_values(ascending=False)
        supplier_names = supplier_spend_series.index.tolist()

        for supplier_name in supplier_names[:15]:
            supplier_spend_data = spend_df[spend_df['Supplier_Name'] == supplier_name]
            supplier_spend = supplier_spend_data['Spend_USD'].sum()

            # PRIORITY 1: Check if ratings exist in spend_df itself (uploaded CSV)
            has_quality_in_spend = 'Quality_Rating' in spend_df.columns
            has_delivery_in_spend = 'Delivery_Rating' in spend_df.columns
            
            if has_quality_in_spend or has_delivery_in_spend:
                # Use ratings from uploaded spend data
                quality_rating = float(supplier_spend_data['Quality_Rating'].mean()) if has_quality_in_spend else 0
                delivery_rating = float(supplier_spend_data['Delivery_Rating'].mean()) if has_delivery_in_spend else 0
                
                # Convert delivery rating (1-5 scale) to percentage (0-100)
                delivery_pct = (delivery_rating / 5.0) * 100 if delivery_rating > 0 else 0
                
                metrics.append({
                    'supplier': supplier_name,
                    'spend_usd': float(supplier_spend),
                    'quality_rating': quality_rating,
                    'delivery_reliability': delivery_pct,
                    'sustainability_score': 0,  # Not in uploaded data
                    'years_in_business': 0,  # Not in uploaded data
                    'certifications': [],
                    'data_source': 'uploaded_csv'
                })
            else:
                # PRIORITY 2: Check supplier_master.csv database
                supplier_info = supplier_df[supplier_df['supplier_name'] == supplier_name]
                
                if not supplier_info.empty:
                    # CASE 2: Supplier found in database - use DB data
                    info = supplier_info.iloc[0]
                    metrics.append({
                        'supplier': supplier_name,
                        'spend_usd': float(supplier_spend),
                        'quality_rating': float(info.get('quality_rating', 0)),
                        'delivery_reliability': float(info.get('delivery_reliability_pct', 0)),
                        'sustainability_score': float(info.get('sustainability_score', 0)),
                        'years_in_business': int(info.get('years_in_business', 0)),
                        'certifications': str(info.get('certifications', '')).split('|'),
                        'data_source': 'database'
                    })
                else:
                    # CASE 3: Supplier NOT in database - try web search fallback
                    web_info = self._get_supplier_info_from_web(supplier_name, category)
                    
                    metrics.append({
                        'supplier': supplier_name,
                        'spend_usd': float(supplier_spend),
                        'quality_rating': web_info.get('quality_rating', 0),
                        'delivery_reliability': web_info.get('delivery_reliability', 0),
                        'sustainability_score': web_info.get('sustainability_score', 0),
                        'years_in_business': web_info.get('years_in_business', 0),
                        'certifications': web_info.get('certifications', []),
                        'data_source': web_info.get('source', 'not_found'),
                        'web_sources': web_info.get('web_sources', [])
                    })

        return metrics

    def _get_supplier_info_from_web(self, supplier_name: str, category: str = None) -> Dict[str, Any]:
        """
        Fetch supplier information from the web when not found in database.
        
        This is a FALLBACK mechanism - only called when supplier is NOT in supplier_master.csv
        Uses LLM (if available) to extract structured info from web search results.
        
        Args:
            supplier_name: Name of the supplier to search for
            category: Optional category context for better search results
            
        Returns:
            Dictionary with supplier metrics (estimated from web data) or empty values
        """
        if not self.web_search_engine:
            return {
                'source': 'not_found',
                'quality_rating': 0,
                'delivery_reliability': 0,
                'sustainability_score': 0,
                'years_in_business': 0,
                'certifications': []
            }
        
        try:
            # Build search query for supplier
            query_parts = [supplier_name]
            if category:
                query_parts.append(category)
            query_parts.extend(['company', 'supplier', 'profile'])
            query = " ".join(query_parts)
            
            # Search the web
            search_result = self.web_search_engine.search(query, num_results=3)
            
            if not search_result.get('success') or not search_result.get('results'):
                return {
                    'source': 'web_search_failed',
                    'quality_rating': 0,
                    'delivery_reliability': 0,
                    'sustainability_score': 0,
                    'years_in_business': 0,
                    'certifications': []
                }
            
            # Extract info using LLM if available
            sources = search_result.get('results', [])
            web_context = search_result.get('context', '')
            
            if self.llm_engine and self.enable_llm:
                extracted_info = self._extract_supplier_info_with_llm(
                    supplier_name, web_context, sources
                )
                if extracted_info:
                    extracted_info['source'] = 'web_search'
                    extracted_info['web_sources'] = [s.get('url', '') for s in sources[:3]]
                    return extracted_info
            
            # Return basic info with web sources for citation
            return {
                'source': 'web_search',
                'quality_rating': 0,  # Cannot reliably extract without LLM
                'delivery_reliability': 0,
                'sustainability_score': 0,
                'years_in_business': 0,
                'certifications': [],
                'web_context': web_context[:500],
                'web_sources': [s.get('url', '') for s in sources[:3]]
            }
            
        except Exception as e:
            self.log(f"Web search failed for {supplier_name}: {e}", "WARN")
            return {
                'source': 'error',
                'quality_rating': 0,
                'delivery_reliability': 0,
                'sustainability_score': 0,
                'years_in_business': 0,
                'certifications': []
            }

    def _extract_supplier_info_with_llm(
        self, 
        supplier_name: str, 
        web_context: str, 
        sources: list
    ) -> Optional[Dict[str, Any]]:
        """
        Use LLM to extract structured supplier info from web search results.
        
        Args:
            supplier_name: Name of the supplier
            web_context: Combined text from web search
            sources: List of source URLs
            
        Returns:
            Extracted supplier info or None if extraction fails
        """
        if not self.llm_engine:
            return None
            
        prompt = f"""Based on the following web search results about "{supplier_name}", extract supplier information.

WEB SEARCH RESULTS:
{web_context}

INSTRUCTIONS:
1. Extract ONLY information explicitly mentioned in the search results
2. If information is not available, use 0 or empty values
3. Be conservative with ratings - only assign high values if clearly supported
4. Return a JSON object with these fields:
   - quality_rating: 0-5 scale (0 if not mentioned)
   - delivery_reliability: 0-100 percentage (0 if not mentioned)
   - sustainability_score: 0-100 (0 if not mentioned)
   - years_in_business: integer (0 if not mentioned)
   - certifications: list of certification names found (empty list if none)
   - company_description: brief description if found

Return ONLY valid JSON, no other text."""

        try:
            response = self.llm_engine.generate(
                prompt=prompt,
                max_tokens=500,
                temperature=0.1  # Low temperature for structured extraction
            )
            
            if response:
                import json
                # Try to parse JSON from response
                response_text = response.strip()
                if response_text.startswith('```'):
                    response_text = response_text.split('```')[1]
                    if response_text.startswith('json'):
                        response_text = response_text[4:]
                    response_text = response_text.strip()
                
                extracted = json.loads(response_text)
                return {
                    'quality_rating': float(extracted.get('quality_rating', 0)),
                    'delivery_reliability': float(extracted.get('delivery_reliability', 0)),
                    'sustainability_score': float(extracted.get('sustainability_score', 0)),
                    'years_in_business': int(extracted.get('years_in_business', 0)),
                    'certifications': extracted.get('certifications', []),
                    'company_description': extracted.get('company_description', '')
                }
        except Exception as e:
            self.log(f"LLM extraction failed for {supplier_name}: {e}", "WARN")
            
        return None

    def _analyze_tail_spend(
        self,
        supplier_spend: pd.Series,
        total_spend: float,
        tail_threshold: float = 0.20
    ) -> Dict[str, Any]:
        """Analyze tail spend (bottom X% of spend)."""
        tail_spend_threshold = total_spend * tail_threshold
        cumulative_spend = 0
        tail_suppliers = []

        for supplier_name in supplier_spend.sort_values().index:
            if cumulative_spend < tail_spend_threshold:
                tail_suppliers.append(supplier_name)
                cumulative_spend += supplier_spend[supplier_name]
            else:
                break

        return {
            'tail_suppliers_count': len(tail_suppliers),
            'tail_spend_amount': float(cumulative_spend),
            'tail_spend_pct': float((cumulative_spend / total_spend) * 100),
            'tail_suppliers': tail_suppliers[:10]  # Top 10 tail suppliers
        }

    def _get_region_corridor_name(self, countries: List[str]) -> str:
        """Get dynamic region corridor name based on countries."""
        region_mapping = {
            'SEA': ['Malaysia', 'Vietnam', 'Thailand', 'Indonesia', 'Singapore', 'Philippines'],
            'East Asia': ['China', 'Japan', 'South Korea', 'Taiwan'],
            'South Asia': ['India', 'Bangladesh', 'Pakistan', 'Sri Lanka'],
            'Europe': ['Germany', 'France', 'UK', 'Spain', 'Italy', 'Netherlands', 'Switzerland', 'Luxembourg'],
            'Americas': ['USA', 'Canada', 'Mexico', 'Brazil', 'Argentina'],
            'Middle East': ['UAE', 'Saudi Arabia', 'Qatar']
        }

        region_counts = {}
        for country in countries:
            for region, region_countries in region_mapping.items():
                if country in region_countries:
                    region_counts[region] = region_counts.get(region, 0) + 1
                    break

        if region_counts:
            dominant_region = max(region_counts, key=region_counts.get)
            corridor_names = {
                'SEA': 'Southeast Asia Supply Corridor',
                'East Asia': 'East Asia Supply Corridor',
                'South Asia': 'South Asia Supply Corridor',
                'Europe': 'European Supply Corridor',
                'Americas': 'Americas Supply Corridor',
                'Middle East': 'Middle East Supply Corridor'
            }
            return corridor_names.get(dominant_region, f'{dominant_region} Supply Corridor')

        return 'Primary Supply Corridor'

    def _generate_summary(
        self,
        total_spend: float,
        supplier_analysis: Dict[str, Any],
        regional_analysis: Dict[str, Any],
        hhi: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate analysis summary."""
        return {
            'total_spend_formatted': f"${total_spend:,.0f}",
            'num_suppliers': supplier_analysis['num_suppliers'],
            'dominant_supplier': supplier_analysis['dominant_supplier'],
            'dominant_supplier_pct': supplier_analysis['dominant_pct'],
            'dominant_country': regional_analysis['dominant_country'],
            'dominant_country_pct': regional_analysis['dominant_country_pct'],
            'hhi_value': hhi['value'],
            'hhi_interpretation': hhi['interpretation'],
            'concentration_level': hhi['concentration_level'],
            'high_risk_indicators': self._identify_high_risk_indicators(
                supplier_analysis, regional_analysis, hhi
            )
        }

    def _identify_high_risk_indicators(
        self,
        supplier_analysis: Dict[str, Any],
        regional_analysis: Dict[str, Any],
        hhi: Dict[str, Any]
    ) -> List[str]:
        """Identify high-risk concentration indicators."""
        indicators = []

        if supplier_analysis['dominant_pct'] > 60:
            indicators.append(f"Single supplier dependency: {supplier_analysis['dominant_pct']:.0f}% concentration")

        if regional_analysis['dominant_country_pct'] > 50:
            indicators.append(f"Geographic concentration: {regional_analysis['dominant_country_pct']:.0f}% in {regional_analysis['dominant_country']}")

        if supplier_analysis['num_suppliers'] <= 2:
            indicators.append(f"Limited supplier diversity: Only {supplier_analysis['num_suppliers']} active suppliers")

        if hhi['value'] > 2500:
            indicators.append(f"High market concentration: HHI = {hhi['value']:.0f}")

        return indicators

    def find_alternate_suppliers(
        self,
        spend_df: pd.DataFrame,
        supplier_df: pd.DataFrame,
        category: str = None,
        subcategory: str = None,
        min_quality_rating: float = 4.0,
        min_delivery_reliability: float = 90
    ) -> Dict[str, Any]:
        """
        Find qualified alternate suppliers not currently in use.

        Args:
            spend_df: Current spend data
            supplier_df: Master supplier data
            category: Product category filter
            subcategory: Subcategory filter (more specific)
            min_quality_rating: Minimum quality threshold
            min_delivery_reliability: Minimum delivery reliability threshold

        Returns:
            Dictionary with alternate supplier recommendations
        """
        current_suppliers = set(spend_df['Supplier_Name'].unique())

        # Get matching suppliers from master
        matching_suppliers = supplier_df[supplier_df['supplier_name'].isin(current_suppliers)]

        product_category = None
        if not matching_suppliers.empty:
            product_category = matching_suppliers.iloc[0]['product_category']
            if 'subcategory' in matching_suppliers.columns:
                subcategory = subcategory or matching_suppliers.iloc[0].get('subcategory')

        # Filter by category/subcategory
        if subcategory and 'subcategory' in supplier_df.columns:
            all_suppliers_in_category = supplier_df[
                (supplier_df['product_category'] == product_category) &
                (supplier_df['subcategory'] == subcategory)
            ]
        elif product_category:
            all_suppliers_in_category = supplier_df[
                supplier_df['product_category'] == product_category
            ]
        else:
            all_suppliers_in_category = supplier_df

        # Find alternates not in current spend
        potential_alternates = set(all_suppliers_in_category['supplier_name'].unique()) - current_suppliers

        # Filter by quality criteria
        alternate_candidates = all_suppliers_in_category[
            (all_suppliers_in_category['supplier_name'].isin(potential_alternates)) &
            (all_suppliers_in_category['quality_rating'] >= min_quality_rating) &
            (all_suppliers_in_category['delivery_reliability_pct'] >= min_delivery_reliability)
        ].sort_values('quality_rating', ascending=False)

        if alternate_candidates.empty:
            return {
                'found': False,
                'alternate_supplier': None,
                'alternate_regions': [],
                'message': 'No qualified alternate suppliers found'
            }

        top_alternate = alternate_candidates.iloc[0]
        alternate_regions = alternate_candidates['country'].unique().tolist()

        return {
            'found': True,
            'alternate_supplier': top_alternate['supplier_name'],
            'alternate_regions': alternate_regions,
            'quality_rating': float(top_alternate['quality_rating']),
            'delivery_reliability': float(top_alternate['delivery_reliability_pct']),
            'total_candidates': len(alternate_candidates),
            'product_category': product_category,
            'subcategory': subcategory
        }
