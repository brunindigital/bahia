# Arremata+

## Deploy na Vercel

1. Suba este diretório para um repositório GitHub.
2. Importe o repositório na Vercel.
3. Crie estas variáveis em **Settings > Environment Variables**:

```text
ALLOWPAY_API_KEY=sua_chave_da_allowpay
ALLOWPAY_WEBHOOK_SECRET=um_segredo_forte
```

4. Faça um novo deploy. A URL pública do projeto será usada automaticamente como `webhook_url` pela integração.

A chave nunca deve ser colocada em HTML ou JavaScript do navegador. O checkout chama as funções serverless em `api/allowpay/`, que protegem a chave e fazem a conversão do valor para centavos.

O webhook deve ser configurado com o mesmo `ALLOWPAY_WEBHOOK_SECRET`. O checkout também consulta o status a cada 4 segundos como reconciliação.
