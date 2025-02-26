require("dotenv").config();
const express = require("express");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

// Database connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("Conectado a MongoDB"))
.catch(err => console.error("Error al conectar a MongoDB", err));

// Middleware
app.use(express.json());
app.use(cors());

// Define Schema
const sensorSchema = new mongoose.Schema({
    tipo: String,
    nombre: String,
    valor: mongoose.Schema.Types.Mixed,
    unidad: String,
    fechaHora: { type: Date, default: Date.now }
});

const SensorActuador = mongoose.model("SensoresActuadores", sensorSchema);

// WebSocket handling
io.on("connection", (socket) => {
    console.log("Cliente conectado");

    socket.on("nuevoDato", async (data) => {
        try {
            const nuevoRegistro = new SensorActuador(data);
            await nuevoRegistro.save();
            io.emit("datoGuardado", nuevoRegistro);
        } catch (error) {
            console.error("Error al guardar dato", error);
        }
    });

    socket.on("disconnect", () => {
        console.log("Cliente desconectado");
    });
});

// Routes
app.get("/sensoresyactuadores", async (req, res) => {
    try {
        const datos = await SensorActuador.find();
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener los datos" });
    }
});

app.get("/sensoresyactuadores/:id", async (req, res) => {
    try {
        const dato = await SensorActuador.findById(req.params.id);
        if (!dato) return res.status(404).json({ error: "No encontrado" });
        res.json(dato);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener el dato" });
    }
});

app.get("/sensoresactuadores/buscar", async (req, res) => {
    try {
        const { tipo, nombre } = req.query;
        const filtro = {};
        if (tipo) filtro.tipo = tipo;
        if (nombre) filtro.nombre = nombre;

        const resultados = await SensorActuador.find(filtro);
        res.json(resultados);
    } catch (error) {
        res.status(500).json({ error: "Error al buscar datos" });
    }
});

app.post("/sensoresactuadores", async (req, res) => {
    try {
        const nuevoRegistro = new SensorActuador(req.body);
        await nuevoRegistro.save();
        io.emit("datoGuardado", nuevoRegistro);
        res.status(201).json(nuevoRegistro);
    } catch (error) {
        res.status(400).json({ error: "Error al crear el registro" });
    }
});

app.put("/sensoresyactuadores/:id", async (req, res) => {
    try {
        const actualizado = await SensorActuador.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!actualizado) return res.status(404).json({ error: "No encontrado" });
        io.emit("datoActualizado", actualizado);
        res.json(actualizado);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar" });
    }
});

// Start the server
server.listen(process.env.PORT || 3000, () => {
    console.log(`Servidor corriendo en http://localhost:${process.env.PORT || 3000}`);
});
