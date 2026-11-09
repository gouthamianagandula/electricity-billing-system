
## Billing logic

- Units = current reading - previous reading
- Energy charge by slab: 0-100 units at Rs 3.50, 101-200 at Rs 5.00, 201-300 at Rs 7.00, above 300 at Rs 9.00
- Total bill = energy charge + fixed charge (Rs 50)
- Due date = reading date + 15 days; unpaid bills past the due date become OVERDUE
- High consumption = usage above 1.5 times the meter's average

## Demo logins (password for all: `password123`)

| Role | Email |
|---|---|
| Admin | admin@demo.com |
| Staff | staff@demo.com |
| Meter Reader | reader@demo.com |
| Customer | customer1@demo.com to customer5@demo.com |

## Run with Docker Compose

Requirements: Docker Desktop.
