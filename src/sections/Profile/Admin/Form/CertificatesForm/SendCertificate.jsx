import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button, Input } from "../../../../../components";
import { api } from "../../../../../services";
import * as XLSX from "xlsx";
import { getCertificatePreview, sendBatchMail } from "./tools/certificateTools";
import { Alert, MicroLoading } from "../../../../../microInteraction";

const Checkbox = ({ id, checked, onCheckedChange }) => {
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      style={{ width: 18, height: 18, accentColor: "#007bff" }}
    />
  );
};

const SendCertificate = () => {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [checkedAttendees, setCheckedAttendees] = useState([]);
  const [subject, setSubject] = useState("Certificate of Appreciation");
  const [description, setDescription] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [mailFrequency, setMailFrequency] = useState(20);
  const [uncheckedFilterText, setUncheckedFilterText] = useState("");
  const [checkedFilterText, setCheckedFilterText] = useState("");
  const [fileUploading, setFileUploading] = useState(false);
  const [certificatePreview, setCertificatePreview] = useState(
    "https://via.placeholder.com/600x300/ff6347/ffffff?text=Certificate+Preview"
  );
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const fetchCertificatePreview = async () => {
      setPreviewLoading(true);
      try {
        const preview = await getCertificatePreview(eventId);
        if (preview) {
          setCertificatePreview(preview);
        }
      } catch (error) {
        setAlert({
          type: "error",
          message: "Failed to load certificate preview",
          position: "top-right",
          duration: 3000,
        });
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchCertificatePreview();
  }, [eventId]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!allowedTypes.includes(file.type)) {
      setAlert({
        type: "error",
        message: "Please upload an Excel file (.xlsx, .xls) or CSV file",
        position: "top-right",
        duration: 3000,
      });
      return;
    }

    setFileUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const extractedAttendees = jsonData.map((row) => {
          const email =
            row.email ||
            row.Email ||
            row.EMAIL ||
            row["Email Address"] ||
            row["email address"];
          const name =
            row.name ||
            row.Name ||
            row.NAME ||
            row["Full Name"] ||
            row["full name"];

          if (!email) {
            throw new Error("Email column not found in Excel sheet");
          }

          return {
            email: email.trim(),
            name: name ? name.trim() : "",
          };
        });

        setAttendees(extractedAttendees);
        setAlert({
          type: "success",
          message: `Successfully loaded ${extractedAttendees.length} attendees`,
          position: "top-right",
          duration: 3000,
        });
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      setAlert({
        type: "error",
        message: error.message || "Failed to process Excel file",
        position: "top-right",
        duration: 3000,
      });
    } finally {
      setFileUploading(false);
    }
  };

  useEffect(() => {
    if (alert) {
      Alert(alert);
      setAlert(null);
    }
  }, [alert]);

  const handleCheckAttendee = (attendee) => {
    setCheckedAttendees((prev) => [...prev, attendee]);
  };

  const handleUncheckAttendee = (attendee) => {
    setCheckedAttendees((prev) =>
      prev.filter((a) => a.email !== attendee.email)
    );
  };

  const handleSelectAllUnchecked = () => {
    setCheckedAttendees([...attendees]);
    setAlert({
      type: "success",
      message: "All attendees selected",
      position: "top-right",
      duration: 2000,
    });
  };

  const handleDeselectAllUnchecked = () => {
    setCheckedAttendees([]);
    setAlert({
      type: "info",
      message: "All attendees deselected",
      position: "top-right",
      duration: 2000,
    });
  };

  useEffect(() => {
    setRecipientEmail(
      checkedAttendees.map((attendee) => attendee.email).join(", ")
    );
  }, [checkedAttendees]);

  const filteredAttendees = attendees.filter(
    (attendee) =>
      attendee.email
        .toLowerCase()
        .includes(uncheckedFilterText.toLowerCase()) ||
      (attendee.name &&
        attendee.name.toLowerCase().includes(uncheckedFilterText.toLowerCase()))
  );

  const filteredCheckedAttendees = checkedAttendees.filter(
    (attendee) =>
      attendee.email.toLowerCase().includes(checkedFilterText.toLowerCase()) ||
      (attendee.name &&
        attendee.name.toLowerCase().includes(checkedFilterText.toLowerCase()))
  );

  const handleSendBatchMail = async () => {
    if (!checkedAttendees.length) {
      setAlert({
        type: "warning",
        message: "Please select at least one recipient",
        position: "top-right",
        duration: 3000,
      });
      return;
    }

    setSendingMail(true);
    try {
      await sendBatchMail({
        batchSize: mailFrequency,
        formId: eventId,
        subject: subject,
        htmlContent: description,
        recipients: checkedAttendees,
      });

      setAlert({
        type: "success",
        message: "Certificates sent successfully!",
        position: "top-right",
        duration: 3000,
      });
    } catch (error) {
      setAlert({
        type: "error",
        message: "Failed to send certificates: " + error.message,
        position: "top-right",
        duration: 3000,
      });
    } finally {
      setSendingMail(false);
    }
  };

  const handleTestMail = async () => {
    if (!checkedAttendees.length) {
      setAlert({
        type: "warning",
        message: "Please select at least one recipient for test mail",
        position: "top-right",
        duration: 3000,
      });
      return;
    }

    setSendingMail(true);
    try {
      await sendBatchMail({
        batchSize: 1,
        formId: eventId,
        subject: `[TEST] ${subject}`,
        htmlContent: description,
        recipients: [checkedAttendees[0]],
      });

      setAlert({
        type: "success",
        message: "Test mail sent successfully!",
        position: "top-right",
        duration: 3000,
      });
    } catch (error) {
      setAlert({
        type: "error",
        message: "Failed to send test mail: " + error.message,
        position: "top-right",
        duration: 3000,
      });
    } finally {
      setSendingMail(false);
    }
  };

  return (
    <div style={{ marginLeft: "5%", marginRight: "5%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* File Upload Section */}
        <div style={{ marginBottom: 20 }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            style={{ display: "none" }}
            id="excel-upload"
            onClick={(e) => {
              // Reset the input value to allow selecting the same file again
              e.target.value = null;
            }}
          />
          <label htmlFor="excel-upload">
            <Button
              as="span"
              disabled={fileUploading}
              style={{ cursor: "pointer" }}
              onClick={() => {
                // Programmatically trigger the file input click
                document.getElementById("excel-upload").click();
              }}
            >
              {fileUploading ? <MicroLoading /> : "Upload Excel/CSV"}
            </Button>
          </label>
          <span style={{ marginLeft: 10, color: "#666" }}>
            Upload Excel/CSV file containing attendee details
          </span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div
            style={{
              flex: 1,
              padding: 20,
              border: "1px solid #ccc",
              borderRadius: 10,
              height: 300,
              objectFit: "cover",
              position: "relative",
            }}
          >
            {previewLoading ? (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <MicroLoading />
              </div>
            ) : (
              <img
                src={certificatePreview}
                alt="Certificate Preview"
                style={{ width: "100%", height: "auto", borderRadius: 10 }}
              />
            )}
          </div>
          <div
            style={{
              flex: 1,
              padding: 20,
              border: "1px solid #ccc",
              borderRadius: 10,
              height: 300,
            }}
          >
            <h3 style={{ marginLeft: "5px" }}>Unchecked Attendees</h3>
            <Input
              type="text"
              placeholder="Filter Unchecked"
              value={uncheckedFilterText}
              onChange={(e) => setUncheckedFilterText(e.target.value)}
              style={{ width: "100%", marginTop: "-10px" }}
            />
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: -10,
                marginLeft: "5px",
              }}
            >
              <Button onClick={handleSelectAllUnchecked}>Select All</Button>
              <Button onClick={handleDeselectAllUnchecked}>Deselect All</Button>
            </div>
            <div
              style={{
                maxHeight: "100px",
                overflowY: "auto",
                border: "1px solid #ccc",
                borderRadius: "5px",
                padding: "10px",
                marginTop: "10px",
                marginLeft: "8px",
                position: "relative",
              }}
            >
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100px",
                  }}
                >
                  <MicroLoading />
                </div>
              ) : filteredAttendees.length > 0 ? (
                filteredAttendees.map((attendee) => (
                  <div
                    key={attendee.email}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <Checkbox
                      checked={checkedAttendees.some(
                        (a) => a.email === attendee.email
                      )}
                      onCheckedChange={() =>
                        checkedAttendees.some((a) => a.email === attendee.email)
                          ? handleUncheckAttendee(attendee)
                          : handleCheckAttendee(attendee)
                      }
                    />
                    <label>
                      {attendee.name
                        ? `${attendee.name} (${attendee.email})`
                        : attendee.email}
                    </label>
                  </div>
                ))
              ) : (
                <p>No unchecked attendees.</p>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 20,
            border: "1px solid #ccc",
            borderRadius: 10,
            maxHeight: "330px",
            overflowY: "auto",
            width: "50%",
          }}
        >
          <h3 style={{ marginLeft: "5px" }}>Checked Attendees</h3>
          <Input
            type="text"
            placeholder="Filter Checked"
            value={checkedFilterText}
            onChange={(e) => setCheckedFilterText(e.target.value)}
            style={{ width: "100%", marginTop: "-10px" }}
          />
          <div
            style={{
              maxHeight: "150px",
              overflowY: "auto",
              border: "1px solid #ccc",
              borderRadius: "5px",
              padding: "10px",
              marginTop: "10px",
              marginLeft: "8px",
              width: "100%",
            }}
          >
            {checkedAttendees.length > 0 ? (
              filteredCheckedAttendees.map((attendee) => (
                <p key={attendee.email}>
                  {attendee.name
                    ? `${attendee.name} (${attendee.email})`
                    : attendee.email}
                </p>
              ))
            ) : (
              <p>No checked attendees.</p>
            )}
          </div>

          <h3 style={{ marginLeft: "5px", marginTop: "10px" }}>
            Recipient Email
          </h3>
          <Input
            type="email"
            placeholder="Emails will be added here"
            value={recipientEmail}
            readOnly
            style={{ width: "100%" }}
          />

          <h3 style={{ marginLeft: "5px" }}>Subject</h3>
          <Input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ width: "100%" }}
          />

          <h3 style={{ marginLeft: "5px" }}>Description</h3>
          <Input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%",
              height: 80,
              marginTop: -10,
            }}
          />

          <h3 style={{ marginLeft: "5px" }}>Mail Frequency</h3>
          <Input
            type="number"
            placeholder="Set mail frequency"
            value={mailFrequency}
            onChange={(e) => setMailFrequency(e.target.value)}
            style={{ marginTop: -10, width: "100%" }}
          />
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: -10,
              marginLeft: "5px",
              position: "relative",
            }}
          >
            <Button onClick={handleTestMail} disabled={sendingMail}>
              {sendingMail ? <MicroLoading /> : "Test Mail"}
            </Button>
            <Button onClick={handleSendBatchMail} disabled={sendingMail}>
              {sendingMail ? <MicroLoading /> : "Send Mail"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendCertificate;
