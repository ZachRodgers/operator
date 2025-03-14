import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import lotsData from "../data/lots_master.json";
import vehicleRegistryData from "../data/vehicle_registry.json";
import Modal from "../components/Modal";
import Slider from "../components/Slider";
import Tooltip from "../components/Tooltip";
import "./PlateRegistry.css";

interface VehicleRegistryEntry {
  lotId: string;
  vehicleId: string;
  plate: string;
  name: string;
  email: string;
  phone: string;
}

export interface RegistryRow extends VehicleRegistryEntry {
  isPlaceholder?: boolean; // "Add new" row
  isEditing?: boolean;     // row-level edit mode
}

type ModalType =
  | "disableRegistry"
  | "unsavedChanges"
  | "removeVehicle"
  | "confirmSave"
  | null;

const PlateRegistry: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const currentLot = lotsData.find((lot) => lot.lotId === lotId);

  // Server registry state
  const [serverRegistryOn, setServerRegistryOn] = useState<boolean>(
    currentLot?.registryOn ?? false
  );

  // Local slider state
  const [registryOn, setRegistryOn] = useState<boolean>(serverRegistryOn);

  // Table rows state
  const [rows, setRows] = useState<RegistryRow[]>([]);
  // Sorting/searching state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"plate" | "name" | "email" | "phone">("plate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  // Unsaved changes flag
  const [isDirty, setIsDirty] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [removalVehicleId, setRemovalVehicleId] = useState<string | null>(null);

  // Track if user toggled from off -> on
  const turnedRegistryOn = useRef(false);

  // On mount: load table data and add a placeholder row
  useEffect(() => {
    const relevant = vehicleRegistryData.filter((v) => v.lotId === lotId);
    const realRows: RegistryRow[] = relevant.map((r) => ({
      ...r,
      isPlaceholder: false,
      isEditing: false,
    }));
    realRows.sort((a, b) => a.plate.localeCompare(b.plate));
    realRows.push(createPlaceholderRow());
    setRows(realRows);
  }, [lotId]);

  /** Create a fresh placeholder row */
  function createPlaceholderRow(): RegistryRow {
    return {
      lotId: lotId || "",
      vehicleId: `PL_${Math.floor(Math.random() * 100000)}`,
      plate: "",
      name: "",
      email: "",
      phone: "",
      isPlaceholder: true,
      isEditing: false,
    };
  }

  // ------------------- REGISTRY TOGGLE -------------------
  const handleToggleRegistry = () => {
    if (!registryOn) {
      if (!serverRegistryOn) {
        turnedRegistryOn.current = true;
        setIsDirty(true);
      }
      setRegistryOn(true);
    } else {
      if (isDirty) {
        setModalType("unsavedChanges");
        setModalOpen(true);
      } else {
        setModalType("disableRegistry");
        setModalOpen(true);
      }
    }
  };

  const confirmDisableRegistry = async () => {
    try {
      if (serverRegistryOn) {
        const resp = await fetch("http://localhost:5000/update-lot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lotId,
            updatedData: { registryOn: false },
          }),
        });
        if (!resp.ok) throw new Error("Failed to disable registry on server.");
      }
      setServerRegistryOn(false);
      setRegistryOn(false);
      setIsDirty(false);
      turnedRegistryOn.current = false;
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Error disabling registry.");
      closeModal();
    }
  };

  const confirmDiscardChanges = async () => {
    await confirmDisableRegistry();
    closeModal();
  };

  // ------------------- SORT + SEARCH -------------------
  const getFilteredAndSortedRows = (): RegistryRow[] => {
    let working = [...rows];
    if (!registryOn) {
      working = working.filter((r) => !r.isPlaceholder);
    }
    working = working.filter((r) => {
      const str = `${r.plate} ${r.name} ${r.email} ${r.phone}`.toLowerCase();
      return str.includes(searchQuery.toLowerCase());
    });
    working.sort((a, b) => {
      if (a.isPlaceholder && b.isPlaceholder) {
        return a.vehicleId.localeCompare(b.vehicleId);
      }
      if (a.isPlaceholder && !b.isPlaceholder) return 1;
      if (!a.isPlaceholder && b.isPlaceholder) return -1;
      let valA = "";
      let valB = "";
      if (sortBy === "plate") {
        valA = a.plate;
        valB = b.plate;
      } else if (sortBy === "name") {
        valA = a.name;
        valB = b.name;
      } else if (sortBy === "email") {
        valA = a.email;
        valB = b.email;
      } else if (sortBy === "phone") {
        valA = a.phone;
        valB = b.phone;
      }
      const cmp = valA.localeCompare(valB);
      return sortOrder === "asc" ? cmp : -cmp;
    });
    // Force the placeholder row to the top
    const placeholderIndex = working.findIndex((r) => r.isPlaceholder);
    if (placeholderIndex >= 0) {
      const [placeholderRow] = working.splice(placeholderIndex, 1);
      working.unshift(placeholderRow);
    }
    return working;
  };

  const handleSort = (col: "plate" | "name" | "email" | "phone") => {
    setSortOrder(sortBy === col && sortOrder === "asc" ? "desc" : "asc");
    setSortBy(col);
  };

  // ------------------- EDIT MODE -------------------
  // Toggle editing state for a row
  const toggleEditRow = (vehicleId: string) => {
    setRows((prev) =>
      prev
        .map((row) => {
          if (row.vehicleId === vehicleId) {
            if (row.isEditing) {
              // If turning off edit, remove the row if all fields are empty (and not a placeholder)
              const allEmpty =
                !row.plate.trim() &&
                !row.name.trim() &&
                !row.email.trim() &&
                !row.phone.trim();
              if (allEmpty && !row.isPlaceholder) {
                return { ...row, isEditing: false, vehicleId: "TO_BE_REMOVED" };
              }
              return { ...row, isEditing: false };
            } else {
              return { ...row, isEditing: true };
            }
          }
          return { ...row, isEditing: false };
        })
        .filter((r) => r.vehicleId !== "TO_BE_REMOVED")
    );
  };

  const handleGlobalClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(".registry-input") ||
      target.closest(".plate-input") ||
      target.closest(".edit-icon2") ||
      target.closest(".remove-icon") ||
      target.closest(".placeholder-input")
    ) {
      return;
    }
    setRows((prev) => {
      let newRows = prev.map((row) =>
        row.isPlaceholder ? row : { ...row, isEditing: false }
      );
      newRows = newRows.filter((row) => {
        if (row.isPlaceholder) return true;
        const allEmpty =
          !row.plate.trim() &&
          !row.name.trim() &&
          !row.email.trim() &&
          !row.phone.trim();
        return !allEmpty;
      });
      return newRows;
    });
  };

  useEffect(() => {
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  // ------------------- FIELD CHANGES -------------------
  const handleFieldChange = (
    rowId: string,
    field: keyof VehicleRegistryEntry,
    value: string
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.vehicleId === rowId) {
          const updated = { ...r, [field]: value };
          if (r.isPlaceholder && value.trim() !== "") {
            updated.isPlaceholder = false;
            updated.isEditing = true;
          }
          return updated;
        }
        return r;
      })
    );
    setIsDirty(true);
  };

  // ------------------- REMOVE -------------------
  const handleRemoveRow = (vehicleId: string) => {
    setRemovalVehicleId(vehicleId);
    setModalType("removeVehicle");
    setModalOpen(true);
  };

  const confirmRemoveVehicle = () => {
    if (removalVehicleId) {
      setRows((prev) => prev.filter((r) => r.vehicleId !== removalVehicleId));
      setIsDirty(true);
    }
    closeModal();
  };

  // ------------------- SAVE -------------------
  // Validation functions
  const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
  const isValidPhone = (phone: string) => phone.replace(/\D/g, "").length >= 7;

  const handleSave = () => {
    setModalType("confirmSave");
    setModalOpen(true);
  };

  const confirmSaveChanges = async () => {
    // Validate all non-placeholder rows
    for (const row of rows.filter((r) => !r.isPlaceholder)) {
      if (!isValidEmail(row.email)) {
        alert(`Invalid email address in row with plate "${row.plate}"`);
        return;
      }
      if (!isValidPhone(row.phone)) {
        alert(`Invalid phone number in row with plate "${row.plate}"`);
        return;
      }
    }
    try {
      const finalRows = rows
        .filter((r) => !r.isPlaceholder)
        .map((r) => ({
          lotId: r.lotId,
          vehicleId: r.vehicleId,
          plate: r.plate,
          name: r.name,
          email: r.email,
          phone: r.phone,
        }));
      const resp = await fetch("http://localhost:5000/update-vehicle-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalRows),
      });
      if (!resp.ok) throw new Error("Failed to update registry.");
      if (!serverRegistryOn && turnedRegistryOn.current) {
        const lotUpdateResp = await fetch("http://localhost:5000/update-lot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lotId,
            updatedData: { registryOn: true },
          }),
        });
        if (!lotUpdateResp.ok)
          throw new Error("Failed to enable registry on server.");
        setServerRegistryOn(true);
      }
      setIsDirty(false);
      turnedRegistryOn.current = false;
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Error saving changes.");
      closeModal();
    }
  };

  // ------------------- UTILS -------------------
  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
    setRemovalVehicleId(null);
  };

  const workingRows = getFilteredAndSortedRows();
  const someRowIsEditing = rows.some((r) => r.isEditing);

  return (
    <div className="content">
      <div className="top-row">
        <h1>Plate Registry</h1>
        <Slider checked={registryOn} onChange={handleToggleRegistry} />
      </div>

      {!registryOn && (
        <p>
          Enable the Plate Registry to add license plates that will not be charged when parked in the lot.
        </p>
      )}

      {registryOn && (
        <>
          <p>
            These license plates will <strong>not</strong> be charged for parking in your lot.
            You can add them manually, upload a spreadsheet, or purchase an addon for monthly billing.
          </p>

          <div className="actions-row">
            <div className="registry-search-bar">
              <img src="/assets/SearchBarIcon.svg" alt="Search" />
              <input
                type="text"
                placeholder="Search plate, name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="upload-wrapper">
              <button className="button secondary" onClick={() => alert("Not implemented!")}>
                Upload Sheet
              </button>
              <div className="tooltip-icon-container">
                <Tooltip
                  text="Our system will parse your spreadsheet to add plates automatically."
                  position="left"
                />
              </div>
            </div>
            <button
              className="button primary"
              style={{ opacity: isDirty ? 1 : 0.6 }}
              onClick={handleSave}
              disabled={!isDirty}
            >
              Save
            </button>
          </div>

          <table className="registry-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort("plate")}
                  className={`sortable-column ${sortBy === "plate" ? "active" : ""}`}
                >
                  Plate
                  <img
                    src={`/assets/${
                      sortBy === "plate" ? "SortArrowSelected.svg" : "SortArrow.svg"
                    }`}
                    alt="Sort"
                    className={`sort-arrow ${sortOrder}`}
                  />
                </th>
                <th
                  onClick={() => handleSort("name")}
                  className={`sortable-column ${sortBy === "name" ? "active" : ""}`}
                >
                  Name
                  <img
                    src={`/assets/${
                      sortBy === "name" ? "SortArrowSelected.svg" : "SortArrow.svg"
                    }`}
                    alt="Sort"
                    className={`sort-arrow ${sortOrder}`}
                  />
                </th>
                <th
                  onClick={() => handleSort("email")}
                  className={`sortable-column ${sortBy === "email" ? "active" : ""}`}
                >
                  Email
                  <img
                    src={`/assets/${
                      sortBy === "email" ? "SortArrowSelected.svg" : "SortArrow.svg"
                    }`}
                    alt="Sort"
                    className={`sort-arrow ${sortOrder}`}
                  />
                </th>
                <th
                  onClick={() => handleSort("phone")}
                  className={`sortable-column ${sortBy === "phone" ? "active" : ""}`}
                >
                  Phone Number
                  <img
                    src={`/assets/${
                      sortBy === "phone" ? "SortArrowSelected.svg" : "SortArrow.svg"
                    }`}
                    alt="Sort"
                    className={`sort-arrow ${sortOrder}`}
                  />
                </th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workingRows.map((row) =>
                row.isPlaceholder ? (
                  <tr key={row.vehicleId} className="placeholder-row">
                    <td>
                      <input
                        type="text"
                        className="placeholder-input plate-placeholder"
                        placeholder="+ Plate"
                        style={{ fontFamily: "'Oxanium', sans-serif" }}
                        value={row.plate}
                        onChange={(e) => handleFieldChange(row.vehicleId, "plate", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="placeholder-input"
                        placeholder="Name"
                        value={row.name}
                        onChange={(e) => handleFieldChange(row.vehicleId, "name", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="placeholder-input"
                        placeholder="email@address.com"
                        value={row.email}
                        onChange={(e) => handleFieldChange(row.vehicleId, "email", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="placeholder-input"
                        placeholder="000-000-0000"
                        value={row.phone}
                        onChange={(e) => handleFieldChange(row.vehicleId, "phone", e.target.value)}
                      />
                    </td>
                    <td>
                      <img src="/assets/Plus.svg" alt="Add row" className="add-icon" />
                    </td>
                  </tr>
                ) : (
                  <tr key={row.vehicleId}>
                    <td>
                      {row.isEditing ? (
                        <input
                          type="text"
                          className="registry-input"
                          value={row.plate}
                          onChange={(e) => handleFieldChange(row.vehicleId, "plate", e.target.value)}
                          style={{ fontFamily: "'Oxanium', sans-serif" }}
                        />
                      ) : (
                        <div className="plate-badge-reg">{row.plate}</div>
                      )}
                    </td>
                    <td>
                      {row.isEditing ? (
                        <input
                          type="text"
                          className="registry-input"
                          value={row.name}
                          onChange={(e) => handleFieldChange(row.vehicleId, "name", e.target.value)}
                        />
                      ) : (
                        <span className="ellipsis-cell">{row.name}</span>
                      )}
                    </td>
                    <td>
                      {row.isEditing ? (
                        <input
                          type="text"
                          className="registry-input"
                          value={row.email}
                          onChange={(e) => handleFieldChange(row.vehicleId, "email", e.target.value)}
                        />
                      ) : (
                        <span className="ellipsis-cell">{row.email}</span>
                      )}
                    </td>
                    <td>
                      {row.isEditing ? (
                        <input
                          type="text"
                          className="registry-input"
                          value={row.phone}
                          onChange={(e) => handleFieldChange(row.vehicleId, "phone", e.target.value)}
                        />
                      ) : (
                        <span className="ellipsis-cell">{row.phone}</span>
                      )}
                    </td>
                    <td>
                      <img
                        src="/assets/Edit2.svg"
                        alt="Edit entry"
                        className={`edit-icon2 ${!row.isEditing ? "" : ""}`}
                        onClick={() => toggleEditRow(row.vehicleId)}
                      />
                      <img
                        src="/assets/Minus.svg"
                        alt="Remove entry"
                        className="remove-icon"
                        onClick={() => handleRemoveRow(row.vehicleId)}
                      />
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </>
      )}

      {modalOpen && modalType === "disableRegistry" && (
        <Modal
          isOpen
          title="Disable Registry?"
          description="This will immediately remove free-parking privileges for all plates in your registry. They will be billed normally."
          confirmText="Disable"
          cancelText="Cancel"
          onConfirm={() => {
            confirmDisableRegistry();
            setModalType(null);
          }}
          onCancel={closeModal}
        />
      )}

      {modalOpen && modalType === "removeVehicle" && (
        <Modal
          isOpen
          title="Remove Registry Entry"
          description="Removing this entry means the vehicle will no longer be exempt from billing. You cannot undo this action unless you add them again."
          confirmText="Remove"
          cancelText="Cancel"
          onConfirm={() => {
            confirmRemoveVehicle();
            setModalType(null);
          }}
          onCancel={closeModal}
        />
      )}

      {modalOpen && modalType === "unsavedChanges" && (
        <Modal
          isOpen
          title="You have unsaved changes!"
          description="Changes will not be applied unless you save before leaving. Discard them and disable the registry?"
          confirmText="Discard & Disable"
          cancelText="Keep Editing"
          onConfirm={() => {
            confirmDiscardChanges();
            setModalType(null);
          }}
          onCancel={closeModal}
        />
      )}

      {modalOpen && modalType === "confirmSave" && (
        <Modal
          isOpen
          title="Confirm Changes"
          description="You're about to update the plate registry on the server."
          confirmText="Save Registry"
          cancelText="Return"
          onConfirm={() => {
            confirmSaveChanges();
            setModalType(null);
          }}
          onCancel={closeModal}
        />
      )}
    </div>
  );
};

export default PlateRegistry;
