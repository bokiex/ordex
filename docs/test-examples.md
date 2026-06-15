# Test Examples

Curl commands to test the order creation and item matching pipeline. Based on real invoice history data.

**Prerequisites:** Dev server running (`bun run dev`) and Ollama running with `qwen2.5:7b`.

## 1. POST /api/orders — Create Order from Message

This is the primary order creation endpoint. It parses the message with AI, matches the customer, loads their invoice history preferences, and matches items to the preferred manufacturer.

### Example A: Encik Tan (3000-F006) — Noodle Stall

This customer historically orders from CHINBOON (mee kia, mee pok), ENGBEE (laksa), and BEEHUAT (kway teow). When they order "laksa", the system should pick `ENGBEE LAKSA` over `HOCKHIN LAKSA` or `NVLAK3KG`.

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi, this is Encik Tan.\n\nTmr order:\n- mee kia 3 pkt\n- mee pok 2 pkt\n- laksa 2 pkt\n- kway teow medium 3 pkt\n- tau pok 5 pkt\n\nThx"
  }'
```

**Expected matching (from invoice history):**
| Item in message | Expected match | Item code | Why |
|-----------------|---------------|-----------|-----|
| mee kia | Mee Kia (3kg) | `CHINBOON MEEKIA (Encik Tan)` | Customer-specific item, freq 3 |
| mee pok | Mee Pok (3kg) | `CHINBOON MEEPOK （Encik Tan）` | Customer-specific item, freq 2 |
| laksa | Laksa (3kg) | `ENGBEE LAKSA` | Preferred over HOCKHIN/NV, freq 2 |
| kway teow medium | Kway Teow (medium) (3kg) | `BEEHUAT KWAYTEOW M` | Preferred over TANLEESENG/NV, freq 2 |
| tau pok | Tau Pok 10pcs/pkt | `MEGA TAUPOK` | Preferred over CHINBOON/ENGSOON, freq 2 |

### Example B: A-PO Hokkien Mee (3000-A005) — Hokkien Mee Stall

This customer orders from TANLEESENG (kway teow, hor fun), KERFOOD (yellow noodle), HOCKHIN (laksa, bee hoon).

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "message": "A-PO here, order for tomorrow:\n\nkway teow medium 4 pkt\nhor fun 3 pkt\nyellow noodle 2 pkt\nlaksa 2 pkt\nbee hoon 3 pkt\nfish cake large 2 pkt\ngarlic chopped 1 pkt\ncarrot cake 3 roll\n\ntks"
  }'
```

**Expected matching (from invoice history):**
| Item in message | Expected match | Item code | Why |
|-----------------|---------------|-----------|-----|
| kway teow medium | Kway Teow (medium) (3kg) | `TANLEESENG KWAYTEOW M` | Preferred over BEEHUAT/NV, freq 2 |
| hor fun | Hor Fun (3kg) | `TANLEESENG HORFUN` | Preferred over BEEHUAT, freq 2 |
| yellow noodle | Yellow Noodle Mee (Round) (3kg) | `KERFOOD YELLOWNOODLE` | Preferred over HONGBEE/HOCKCHUANANN, freq 2 |
| laksa | Laksa (3kg) | `HOCKHIN LAKSA` | Preferred over ENGBEE/NV, freq 2 |
| bee hoon | Bee Hoon (3kg) | `HOCKHIN BEEHOON` | Preferred over ENGBEE/TAISUN/etc., freq 2 |
| fish cake large | Fish Cake (L) 1kg | `PENGWANGFISHCAKE(L)大鱼饼` | freq 2 |
| garlic chopped | Chopped Garlic (1kg) | `LEEFOODGARLIC1KG蒜米` | freq 2 |
| carrot cake | Carrot Cake (Halal) (5roll/pkt-2kg) | `HIAPCHENCARROTCAKE(HALAL)萝卜糕` | freq 2 |

### Example C: AMK 527 / A X Fusion (3000-A012) — Fusion Stall

This customer orders from HONGBEE (handmade noodle), HOCKHIN (bee hoon), BEE HUAT (hor fun).

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "message": "AMK 527 order:\n\nhandmade noodle 2 pkt\nbee hoon 3 pkt\nhor fun 2 pkt\nbeansprout 3 pkt\ntau pok 5 pkt\npress tofu 4 pkt\npickled green chilli 1 pkt\n\nthx"
  }'
```

**Expected matching (from invoice history):**
| Item in message | Expected match | Item code | Why |
|-----------------|---------------|-----------|-----|
| handmade noodle | Handmaded Noodle/Lor Mee (3kg) | `HONGBEE HandmadedNoodle` | Preferred over KERFOOD, freq 2 |
| bee hoon | Bee Hoon (3kg) | `HOCKHIN BEEHOON` | Preferred over ENGBEE/etc., freq 2 |
| hor fun | Hor Fun (3kg) | `BEE HUAT HORFUN` | Preferred over TANLEESENG, freq 2 |
| beansprout | Beansprout (1kg) | `DICKSONBS豆芽` | freq 2 |
| tau pok | Tau Pok 10pcs/pkt | `MEGA TAUPOK` | freq 1 |
| press tofu | Press Tofu (300g) | `SUNUPPRESSTOFU豆腐` | freq 2 |
| pickled green chilli | Pickled Green Chilli (1.5kgX2) | `TIRAMPICKLEDGREENCHILLI腌制青辣椒` | freq 2 |

### Example D: Unknown Customer — Falls Back to Catalogue

When the customer is not matched to a debtor, there's no invoice history, so items match generically from the catalogue (first match wins).

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Order for new stall:\n- bee hoon 5 pkt\n- laksa 3 pkt\n- yellow noodle 2 pkt"
  }'
```

**Expected:** All items matched via catalogue search (`source: "catalogue"`), no price populated.

## 2. POST /api/webhook/whatsapp — Store Incoming WhatsApp Message

Simulates a WhatsApp message arriving. The webhook stores the raw text in `incoming_messages` and publishes an SSE refresh event. It does not parse with AI or create an order until messages are selected for generation.

```bash
curl -X POST http://localhost:3000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456",
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": { "display_phone_number": "6512345678", "phone_number_id": "123" },
          "contacts": [{ "wa_id": "6591234567", "profile": { "name": "Encik Tan" } }],
          "messages": [{
            "id": "wamid.test123",
            "from": "6591234567",
            "timestamp": "1709625600",
            "type": "text",
            "text": { "body": "Hi order tmr:\nmee kia 3 pkt\nlaksa 2 pkt\ntau pok 5 pkt\nthx" }
          }]
        }
      }]
    }]
  }'
```

**Expected response:**
```json
{
  "received": 1,
  "messages": [
    {
      "from": "6591234567",
      "name": "Encik Tan",
      "messageId": "wamid.test123",
      "incomingMessageId": 1,
      "duplicate": false
    }
  ]
}
```

## 3. POST /api/incoming-messages — Store Worker Message

Simulates the WhatsApp group worker forwarding a raw group message fragment. This path also stores only; incomplete order fragments should still succeed.

```bash
curl -X POST http://localhost:3000/api/incoming-messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "mee kia 3 pkt",
    "customerNameHint": "Encik Tan",
    "from": "6591234567",
    "timestamp": "1709625601",
    "whatsappMessageId": "worker-test-1"
  }'
```

## 4. POST /api/incoming-messages — Generate Order from Selected Messages

After storing one or more incoming messages from the same sender, pass their IDs to generate a draft order. This is the same API used by the Incoming Messages tab.

```bash
curl -X POST http://localhost:3000/api/incoming-messages \
  -H "Content-Type: application/json" \
  -d '{
    "messageIds": [1, 2]
  }'
```

**Expected:** `201` with full `OrderWithItems` JSON. The selected incoming messages are marked `used`.

## 5. Verify Order Details

After creating an order, inspect it:

```bash
# List all orders
curl http://localhost:3000/api/orders

# Get specific order with items
curl http://localhost:3000/api/orders/1
```

## Key Things to Verify

1. **Manufacturer preference**: Same product name resolves to different item codes per customer
2. **Price from history**: Unit prices are populated from the customer's most recent invoice
3. **Fallback**: Unknown customers get generic catalogue matches (no price)
4. **Customer matching**: Company name/alias fuzzy matches to debtor code
5. **Agent populated**: Order agent field comes from debtor record
