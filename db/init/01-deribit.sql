--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-09-18 16:45:21

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 236 (class 1255 OID 38133)
-- Name: func_upsert_account_snapshot(jsonb, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.func_upsert_account_snapshot(p_payload jsonb, p_snapshot_at timestamp with time zone DEFAULT now()) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_snapshot_id BIGINT;
  v_currency TEXT;
BEGIN
  v_currency := COALESCE(p_payload->>'currency', 'UNKNOWN');

  INSERT INTO tbl_deribit_account_snapshot (
    snapshot_at, 
	currency,
    balance, 
	equity, 
	margin_balance, 
	available_funds, 
	available_withdrawal_funds, 
	locked_balance,
    fee_balance, 
	spot_reserve, 
	additional_reserve,
    total_pl, futures_pl, 
	options_pl, 
	session_upl, 
	session_rpl,
    futures_session_upl, 
	futures_session_rpl, 
	options_session_upl, 
	options_session_rpl,
    initial_margin, 
	maintenance_margin, 
	projected_initial_margin, 
	projected_maintenance_margin,
    margin_model, 
	portfolio_margining_enabled, 
	cross_collateral_enabled,
    delta_total, 
	projected_delta_total, 
	options_delta, 
	options_gamma, 
	options_theta, 
	options_vega,
    estimated_liquidation_ratio, 
	options_value,
    raw_payload
  )
  VALUES (
    p_snapshot_at, v_currency,
    (p_payload->>'balance')::NUMERIC,
    (p_payload->>'equity')::NUMERIC,
    (p_payload->>'margin_balance')::NUMERIC,
    (p_payload->>'available_funds')::NUMERIC,
    (p_payload->>'available_withdrawal_funds')::NUMERIC,
    (p_payload->>'locked_balance')::NUMERIC,
    (p_payload->>'fee_balance')::NUMERIC,
    (p_payload->>'spot_reserve')::NUMERIC,
    (p_payload->>'additional_reserve')::NUMERIC,
    (p_payload->>'total_pl')::NUMERIC,
    (p_payload->>'futures_pl')::NUMERIC,
    (p_payload->>'options_pl')::NUMERIC,
    (p_payload->>'session_upl')::NUMERIC,
    (p_payload->>'session_rpl')::NUMERIC,
    (p_payload->>'futures_session_upl')::NUMERIC,
    (p_payload->>'futures_session_rpl')::NUMERIC,
    (p_payload->>'options_session_upl')::NUMERIC,
    (p_payload->>'options_session_rpl')::NUMERIC,
    (p_payload->>'initial_margin')::NUMERIC,
    (p_payload->>'maintenance_margin')::NUMERIC,
    (p_payload->>'projected_initial_margin')::NUMERIC,
    (p_payload->>'projected_maintenance_margin')::NUMERIC,
    p_payload->>'margin_model',
    (p_payload->>'portfolio_margining_enabled')::BOOLEAN,
    (p_payload->>'cross_collateral_enabled')::BOOLEAN,
    (p_payload->>'delta_total')::NUMERIC,
    (p_payload->>'projected_delta_total')::NUMERIC,
    (p_payload->>'options_delta')::NUMERIC,
    (p_payload->>'options_gamma')::NUMERIC,
    (p_payload->>'options_theta')::NUMERIC,
    (p_payload->>'options_vega')::NUMERIC,
    (p_payload->>'estimated_liquidation_ratio')::NUMERIC,
    (p_payload->>'options_value')::NUMERIC,
    p_payload
  )
  ON CONFLICT (currency, snapshot_at)
  DO UPDATE SET
    balance = EXCLUDED.balance,
    equity = EXCLUDED.equity,
    margin_balance = EXCLUDED.margin_balance,
    available_funds = EXCLUDED.available_funds,
    available_withdrawal_funds = EXCLUDED.available_withdrawal_funds,
    locked_balance = EXCLUDED.locked_balance,
    fee_balance = EXCLUDED.fee_balance,
    spot_reserve = EXCLUDED.spot_reserve,
    additional_reserve = EXCLUDED.additional_reserve,
    total_pl = EXCLUDED.total_pl,
    futures_pl = EXCLUDED.futures_pl,
    options_pl = EXCLUDED.options_pl,
    session_upl = EXCLUDED.session_upl,
    session_rpl = EXCLUDED.session_rpl,
    futures_session_upl = EXCLUDED.futures_session_upl,
    futures_session_rpl = EXCLUDED.futures_session_rpl,
    options_session_upl = EXCLUDED.options_session_upl,
    options_session_rpl = EXCLUDED.options_session_rpl,
    initial_margin = EXCLUDED.initial_margin,
    maintenance_margin = EXCLUDED.maintenance_margin,
    projected_initial_margin = EXCLUDED.projected_initial_margin,
    projected_maintenance_margin = EXCLUDED.projected_maintenance_margin,
    margin_model = EXCLUDED.margin_model,
    portfolio_margining_enabled = EXCLUDED.portfolio_margining_enabled,
    cross_collateral_enabled = EXCLUDED.cross_collateral_enabled,
    delta_total = EXCLUDED.delta_total,
    projected_delta_total = EXCLUDED.projected_delta_total,
    options_delta = EXCLUDED.options_delta,
    options_gamma = EXCLUDED.options_gamma,
    options_theta = EXCLUDED.options_theta,
    options_vega = EXCLUDED.options_vega,
    estimated_liquidation_ratio = EXCLUDED.estimated_liquidation_ratio,
    options_value = EXCLUDED.options_value,
    raw_payload = EXCLUDED.raw_payload
  RETURNING snapshot_id
  INTO v_snapshot_id;

  -- replace child rows
  DELETE FROM tbl_deribit_account_map    WHERE snapshot_id = v_snapshot_id;
  DELETE FROM tbl_deribit_account_limits WHERE snapshot_id = v_snapshot_id;

  -- maps (run each INSERT directly; no PERFORM)
  WITH m AS (
    SELECT 'options_gamma'::TEXT AS map_type, p_payload->'options_gamma_map' AS obj
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v);

  WITH m AS (
    SELECT 'options_theta'::TEXT AS map_type, p_payload->'options_theta_map' AS obj 
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v);

  WITH m AS (
    SELECT 'options_vega'::TEXT AS map_type, p_payload->'options_vega_map' AS obj
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v);

  WITH m AS (
    SELECT 'delta_total'::TEXT AS map_type, p_payload->'delta_total_map' AS obj
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v) ;

  WITH m AS (
    SELECT 'estimated_liquidation_ratio'::TEXT AS map_type, p_payload->'estimated_liquidation_ratio_map' AS obj
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v) ;

  -- limits
  INSERT INTO tbl_deribit_account_limits (
    snapshot_id,
    limits_per_currency,
    matching_engine,
    non_matching_engine
  )
  VALUES (
    v_snapshot_id,
    (p_payload #>> '{limits,limits_per_currency}')::BOOLEAN,
    p_payload #> '{limits,matching_engine}',
    p_payload #> '{limits,non_matching_engine}'
  );

  RETURN v_snapshot_id;
END;
$$;


ALTER FUNCTION public.func_upsert_account_snapshot(p_payload jsonb, p_snapshot_at timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 224 (class 1255 OID 38138)
-- Name: func_upsert_account_snapshot(jsonb, numeric, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.func_upsert_account_snapshot(p_payload jsonb, p_ticker_last_price numeric, p_snapshot_at timestamp with time zone DEFAULT now()) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_snapshot_id BIGINT;
  v_currency TEXT;
BEGIN
  v_currency := COALESCE(p_payload->>'currency', 'UNKNOWN');

  INSERT INTO tbl_deribit_account_snapshot (
    snapshot_at, 
	currency,
	ticker_last_price,
    balance, 
	equity, 
	margin_balance, 
	available_funds, 
	available_withdrawal_funds, 
	locked_balance,
    fee_balance, 
	spot_reserve, 
	additional_reserve,
    total_pl, futures_pl, 
	options_pl, 
	session_upl, 
	session_rpl,
    futures_session_upl, 
	futures_session_rpl, 
	options_session_upl, 
	options_session_rpl,
    initial_margin, 
	maintenance_margin, 
	projected_initial_margin, 
	projected_maintenance_margin,
    margin_model, 
	portfolio_margining_enabled, 
	cross_collateral_enabled,
    delta_total, 
	projected_delta_total, 
	options_delta, 
	options_gamma, 
	options_theta, 
	options_vega,
    estimated_liquidation_ratio, 
	options_value,
    raw_payload
  )
  VALUES (
    p_snapshot_at, v_currency, p_ticker_last_price,
    (p_payload->>'balance')::NUMERIC,
    (p_payload->>'equity')::NUMERIC,
    (p_payload->>'margin_balance')::NUMERIC,
    (p_payload->>'available_funds')::NUMERIC,
    (p_payload->>'available_withdrawal_funds')::NUMERIC,
    (p_payload->>'locked_balance')::NUMERIC,
    (p_payload->>'fee_balance')::NUMERIC,
    (p_payload->>'spot_reserve')::NUMERIC,
    (p_payload->>'additional_reserve')::NUMERIC,
    (p_payload->>'total_pl')::NUMERIC,
    (p_payload->>'futures_pl')::NUMERIC,
    (p_payload->>'options_pl')::NUMERIC,
    (p_payload->>'session_upl')::NUMERIC,
    (p_payload->>'session_rpl')::NUMERIC,
    (p_payload->>'futures_session_upl')::NUMERIC,
    (p_payload->>'futures_session_rpl')::NUMERIC,
    (p_payload->>'options_session_upl')::NUMERIC,
    (p_payload->>'options_session_rpl')::NUMERIC,
    (p_payload->>'initial_margin')::NUMERIC,
    (p_payload->>'maintenance_margin')::NUMERIC,
    (p_payload->>'projected_initial_margin')::NUMERIC,
    (p_payload->>'projected_maintenance_margin')::NUMERIC,
    p_payload->>'margin_model',
    (p_payload->>'portfolio_margining_enabled')::BOOLEAN,
    (p_payload->>'cross_collateral_enabled')::BOOLEAN,
    (p_payload->>'delta_total')::NUMERIC,
    (p_payload->>'projected_delta_total')::NUMERIC,
    (p_payload->>'options_delta')::NUMERIC,
    (p_payload->>'options_gamma')::NUMERIC,
    (p_payload->>'options_theta')::NUMERIC,
    (p_payload->>'options_vega')::NUMERIC,
    (p_payload->>'estimated_liquidation_ratio')::NUMERIC,
    (p_payload->>'options_value')::NUMERIC,
    p_payload
  )
  ON CONFLICT (currency, snapshot_at)
  DO UPDATE SET
    balance = EXCLUDED.balance,
    equity = EXCLUDED.equity,
    margin_balance = EXCLUDED.margin_balance,
    available_funds = EXCLUDED.available_funds,
    available_withdrawal_funds = EXCLUDED.available_withdrawal_funds,
    locked_balance = EXCLUDED.locked_balance,
    fee_balance = EXCLUDED.fee_balance,
    spot_reserve = EXCLUDED.spot_reserve,
    additional_reserve = EXCLUDED.additional_reserve,
    total_pl = EXCLUDED.total_pl,
    futures_pl = EXCLUDED.futures_pl,
    options_pl = EXCLUDED.options_pl,
    session_upl = EXCLUDED.session_upl,
    session_rpl = EXCLUDED.session_rpl,
    futures_session_upl = EXCLUDED.futures_session_upl,
    futures_session_rpl = EXCLUDED.futures_session_rpl,
    options_session_upl = EXCLUDED.options_session_upl,
    options_session_rpl = EXCLUDED.options_session_rpl,
    initial_margin = EXCLUDED.initial_margin,
    maintenance_margin = EXCLUDED.maintenance_margin,
    projected_initial_margin = EXCLUDED.projected_initial_margin,
    projected_maintenance_margin = EXCLUDED.projected_maintenance_margin,
    margin_model = EXCLUDED.margin_model,
    portfolio_margining_enabled = EXCLUDED.portfolio_margining_enabled,
    cross_collateral_enabled = EXCLUDED.cross_collateral_enabled,
    delta_total = EXCLUDED.delta_total,
    projected_delta_total = EXCLUDED.projected_delta_total,
    options_delta = EXCLUDED.options_delta,
    options_gamma = EXCLUDED.options_gamma,
    options_theta = EXCLUDED.options_theta,
    options_vega = EXCLUDED.options_vega,
    estimated_liquidation_ratio = EXCLUDED.estimated_liquidation_ratio,
    options_value = EXCLUDED.options_value,
    raw_payload = EXCLUDED.raw_payload
  RETURNING snapshot_id
  INTO v_snapshot_id;

  -- replace child rows
  DELETE FROM tbl_deribit_account_map    WHERE snapshot_id = v_snapshot_id;
  DELETE FROM tbl_deribit_account_limits WHERE snapshot_id = v_snapshot_id;

  -- maps (run each INSERT directly; no PERFORM)
  WITH m AS (
    SELECT 'options_gamma'::TEXT AS map_type, p_payload->'options_gamma_map' AS obj
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v);

  WITH m AS (
    SELECT 'options_theta'::TEXT AS map_type, p_payload->'options_theta_map' AS obj 
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v);

  WITH m AS (
    SELECT 'options_vega'::TEXT AS map_type, p_payload->'options_vega_map' AS obj
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v);

  WITH m AS (
    SELECT 'delta_total'::TEXT AS map_type, p_payload->'delta_total_map' AS obj
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v) ;

  WITH m AS (
    SELECT 'estimated_liquidation_ratio'::TEXT AS map_type, p_payload->'estimated_liquidation_ratio_map' AS obj
  )
  INSERT INTO tbl_deribit_account_map (snapshot_id, map_type, map_key, map_value)
  SELECT v_snapshot_id, m.map_type, e.k, e.v::NUMERIC
  FROM m, LATERAL jsonb_each_text(COALESCE(m.obj, '{}'::jsonb)) AS e(k, v) ;

  -- limits
  INSERT INTO tbl_deribit_account_limits (
    snapshot_id,
    limits_per_currency,
    matching_engine,
    non_matching_engine
  )
  VALUES (
    v_snapshot_id,
    (p_payload #>> '{limits,limits_per_currency}')::BOOLEAN,
    p_payload #> '{limits,matching_engine}',
    p_payload #> '{limits,non_matching_engine}'
  );

  RETURN v_snapshot_id;
END;
$$;


ALTER FUNCTION public.func_upsert_account_snapshot(p_payload jsonb, p_ticker_last_price numeric, p_snapshot_at timestamp with time zone) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 34131)
-- Name: tbl_currency; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tbl_currency (
    id_currency integer NOT NULL,
    str_symbol character varying(10) NOT NULL,
    str_currency character varying(50) NOT NULL
);


ALTER TABLE public.tbl_currency OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 34130)
-- Name: tbl_currency_id_currency_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.tbl_currency ALTER COLUMN id_currency ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.tbl_currency_id_currency_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 222 (class 1259 OID 38114)
-- Name: tbl_deribit_account_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tbl_deribit_account_limits (
    snapshot_id bigint NOT NULL,
    limits_per_currency boolean,
    matching_engine jsonb,
    non_matching_engine jsonb
);


ALTER TABLE public.tbl_deribit_account_limits OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 38102)
-- Name: tbl_deribit_account_map; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tbl_deribit_account_map (
    snapshot_id bigint NOT NULL,
    map_type text NOT NULL,
    map_key text NOT NULL,
    map_value numeric
);


ALTER TABLE public.tbl_deribit_account_map OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 38086)
-- Name: tbl_deribit_account_snapshot; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tbl_deribit_account_snapshot (
    snapshot_id bigint NOT NULL,
    snapshot_at timestamp with time zone DEFAULT now() NOT NULL,
    currency text NOT NULL,
    balance numeric,
    equity numeric,
    margin_balance numeric,
    available_funds numeric,
    available_withdrawal_funds numeric,
    locked_balance numeric,
    fee_balance numeric,
    spot_reserve numeric,
    additional_reserve numeric,
    total_pl numeric,
    futures_pl numeric,
    options_pl numeric,
    session_upl numeric,
    session_rpl numeric,
    futures_session_upl numeric,
    futures_session_rpl numeric,
    options_session_upl numeric,
    options_session_rpl numeric,
    initial_margin numeric,
    maintenance_margin numeric,
    projected_initial_margin numeric,
    projected_maintenance_margin numeric,
    margin_model text,
    portfolio_margining_enabled boolean,
    cross_collateral_enabled boolean,
    delta_total numeric,
    projected_delta_total numeric,
    options_delta numeric,
    options_gamma numeric,
    options_theta numeric,
    options_vega numeric,
    estimated_liquidation_ratio numeric,
    options_value numeric,
    raw_payload jsonb NOT NULL,
    ticker_last_price numeric
);


ALTER TABLE public.tbl_deribit_account_snapshot OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 38085)
-- Name: tbl_deribit_account_snapshot_snapshot_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tbl_deribit_account_snapshot_snapshot_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tbl_deribit_account_snapshot_snapshot_id_seq OWNER TO postgres;

--
-- TOC entry 4883 (class 0 OID 0)
-- Dependencies: 219
-- Name: tbl_deribit_account_snapshot_snapshot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tbl_deribit_account_snapshot_snapshot_id_seq OWNED BY public.tbl_deribit_account_snapshot.snapshot_id;


--
-- TOC entry 223 (class 1259 OID 38144)
-- Name: v_snapshot; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_snapshot AS
 SELECT snapshot_id,
    snapshot_at,
    ticker_last_price,
    balance,
    equity,
    round((equity * ticker_last_price), 2) AS equity_usd,
    margin_balance,
    available_funds,
    total_pl,
    delta_total,
    options_delta,
    options_gamma,
    options_theta,
    options_vega
   FROM public.tbl_deribit_account_snapshot;


ALTER VIEW public.v_snapshot OWNER TO postgres;

--
-- TOC entry 4714 (class 2604 OID 38089)
-- Name: tbl_deribit_account_snapshot snapshot_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_deribit_account_snapshot ALTER COLUMN snapshot_id SET DEFAULT nextval('public.tbl_deribit_account_snapshot_snapshot_id_seq'::regclass);


--
-- TOC entry 4717 (class 2606 OID 34135)
-- Name: tbl_currency pk_currency; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_currency
    ADD CONSTRAINT pk_currency PRIMARY KEY (id_currency);


--
-- TOC entry 4729 (class 2606 OID 38120)
-- Name: tbl_deribit_account_limits tbl_deribit_account_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_deribit_account_limits
    ADD CONSTRAINT tbl_deribit_account_limits_pkey PRIMARY KEY (snapshot_id);


--
-- TOC entry 4727 (class 2606 OID 38108)
-- Name: tbl_deribit_account_map tbl_deribit_account_map_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_deribit_account_map
    ADD CONSTRAINT tbl_deribit_account_map_pkey PRIMARY KEY (snapshot_id, map_type, map_key);


--
-- TOC entry 4721 (class 2606 OID 38094)
-- Name: tbl_deribit_account_snapshot tbl_deribit_account_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_deribit_account_snapshot
    ADD CONSTRAINT tbl_deribit_account_snapshot_pkey PRIMARY KEY (snapshot_id);


--
-- TOC entry 4723 (class 2606 OID 38131)
-- Name: tbl_deribit_account_snapshot uq_tbl_deribit_currency_at; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_deribit_account_snapshot
    ADD CONSTRAINT uq_tbl_deribit_currency_at UNIQUE (currency, snapshot_at);


--
-- TOC entry 4724 (class 1259 OID 38128)
-- Name: idx_deribit_map_snapshot; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deribit_map_snapshot ON public.tbl_deribit_account_map USING btree (snapshot_id);


--
-- TOC entry 4725 (class 1259 OID 38129)
-- Name: idx_deribit_map_type_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deribit_map_type_key ON public.tbl_deribit_account_map USING btree (map_type, map_key);


--
-- TOC entry 4718 (class 1259 OID 38126)
-- Name: idx_deribit_snapshot_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deribit_snapshot_at ON public.tbl_deribit_account_snapshot USING btree (snapshot_at DESC);


--
-- TOC entry 4719 (class 1259 OID 38127)
-- Name: idx_deribit_snapshot_currency_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deribit_snapshot_currency_at ON public.tbl_deribit_account_snapshot USING btree (currency, snapshot_at DESC);


--
-- TOC entry 4731 (class 2606 OID 38121)
-- Name: tbl_deribit_account_limits tbl_deribit_account_limits_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_deribit_account_limits
    ADD CONSTRAINT tbl_deribit_account_limits_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.tbl_deribit_account_snapshot(snapshot_id) ON DELETE CASCADE;


--
-- TOC entry 4730 (class 2606 OID 38109)
-- Name: tbl_deribit_account_map tbl_deribit_account_map_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tbl_deribit_account_map
    ADD CONSTRAINT tbl_deribit_account_map_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.tbl_deribit_account_snapshot(snapshot_id) ON DELETE CASCADE;


-- Completed on 2025-09-18 16:45:21

--
-- PostgreSQL database dump complete
--

